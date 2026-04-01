import { useEffect, useState, useCallback } from "react"
import "./sidepanel.css"

// Types
interface UserInfo {
  id: string
  email: string
  plan: string
}

type ConnectionStatus = "disconnected" | "checking" | "connected" | "error"

function Popup() {
  // Connection
  const [backendUrl, setBackendUrl] = useState(
    process.env.PLASMO_PUBLIC_BACKEND_URL || "http://localhost:3000"
  )
  const [licenseKey, setLicenseKey] = useState("")
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected")
  const [statusMessage, setStatusMessage] = useState("")
  const [authToken, setAuthToken] = useState("")
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)

  // Google Sheets
  const [googleConnected, setGoogleConnected] = useState(false)
  const [sheetId, setSheetId] = useState("")
  const [sheetSaving, setSheetSaving] = useState(false)
  const [sheetStatus, setSheetStatus] = useState("")

  // Leads
  const [leadsCount, setLeadsCount] = useState(0)
  const [onFbPage, setOnFbPage] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [pushStatus, setPushStatus] = useState("")
  const [lastPushAt, setLastPushAt] = useState<number | null>(null)
  const [lastPushCount, setLastPushCount] = useState(0)

  // Settings
  const [autoApprove, setAutoApprove] = useState(false)
  const [pushDelay, setPushDelay] = useState(2)

  // Onboarding
  const [showWelcome, setShowWelcome] = useState(false)
  const [welcomeLoaded, setWelcomeLoaded] = useState(false)

  // Network
  const [networkStatus, setNetworkStatus] = useState<"online" | "offline">("online")

  // Load persisted state on mount
  useEffect(() => {
    chrome.storage.local.get(
      [
        "backendUrl",
        "licenseKey",
        "authToken",
        "userId",
        "userEmail",
        "userPlan",
        "googleConnected",
        "sheetId",
        "autoApproveEnabled",
        "pushDelayMin",
        "pendingLeadsCount",
        "onMemberRequestsPage",
        "lastPushAt",
        "lastPushCount",
        "hasSeenWelcome"
      ],
      (result) => {
        if (!result.hasSeenWelcome && !result.authToken) {
          setShowWelcome(true)
        }
        setWelcomeLoaded(true)
        if (result.backendUrl) setBackendUrl(result.backendUrl)
        if (result.licenseKey) setLicenseKey(result.licenseKey)
        if (result.authToken) {
          setAuthToken(result.authToken)
          setConnectionStatus("connected")
          setStatusMessage("Connected")
          setUserInfo({
            id: result.userId || "",
            email: result.userEmail || "",
            plan: result.userPlan || ""
          })
          console.log("[GroupMailBox] Restored auth from storage, userId:", result.userId)
        }
        if (result.googleConnected) setGoogleConnected(true)
        if (result.sheetId) setSheetId(result.sheetId)
        if (result.autoApproveEnabled) setAutoApprove(true)
        if (result.pushDelayMin) setPushDelay(result.pushDelayMin / 1000)
        setLeadsCount(result.pendingLeadsCount || 0)
        setOnFbPage(result.onMemberRequestsPage || false)
        if (result.lastPushAt) setLastPushAt(result.lastPushAt)
        if (result.lastPushCount) setLastPushCount(result.lastPushCount)
      }
    )
  }, [])

  // Sync status from backend when already authenticated
  useEffect(() => {
    if (!authToken) return

    fetch(`${backendUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setGoogleConnected(data.user.googleConnected || false)
          if (data.user.sheetId) setSheetId(data.user.sheetId)
          chrome.storage.local.set({
            googleConnected: data.user.googleConnected || false,
            sheetId: data.user.sheetId || ""
          })
        }
      })
      .catch(() => {})
  }, [authToken, backendUrl])

  // Listen for storage changes (lead count updates from content script)
  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area !== "local") return
      if (changes.pendingLeadsCount) {
        setLeadsCount(changes.pendingLeadsCount.newValue || 0)
      }
      if (changes.onMemberRequestsPage) {
        setOnFbPage(changes.onMemberRequestsPage.newValue || false)
      }
      if (changes.lastPushAt) {
        setLastPushAt(changes.lastPushAt.newValue)
      }
      if (changes.lastPushCount) {
        setLastPushCount(changes.lastPushCount.newValue || 0)
      }
      if (changes.googleConnected) {
        setGoogleConnected(changes.googleConnected.newValue)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  // Network status listener
  useEffect(() => {
    const handleOffline = () => setNetworkStatus("offline")
    const handleOnline = () => setNetworkStatus("online")
    window.addEventListener("offline", handleOffline)
    window.addEventListener("online", handleOnline)
    return () => {
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("online", handleOnline)
    }
  }, [])

  // Verify license
  const handleVerify = useCallback(async () => {
    if (!licenseKey.trim()) {
      setStatusMessage("Enter a license key")
      return
    }

    setConnectionStatus("checking")
    setStatusMessage("Verifying...")

    try {
      const response = await fetch(`${backendUrl}/api/auth/verify-license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: licenseKey.trim() })
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(
          (body as { error?: string }).error || `HTTP ${response.status}`
        )
      }

      const data = (await response.json()) as {
        token: string
        user: UserInfo
      }

      setAuthToken(data.token)
      setUserInfo(data.user)
      setConnectionStatus("connected")
      setStatusMessage("Connected")

      // Persist — store token expiry (24h from now as fallback)
      let tokenExpiresAt = Date.now() + 24 * 60 * 60 * 1000
      try {
        const payload = JSON.parse(atob(data.token.split(".")[1]))
        if (payload.exp) tokenExpiresAt = payload.exp * 1000
      } catch {}

      await chrome.storage.local.set({
        backendUrl,
        licenseKey: licenseKey.trim(),
        authToken: data.token,
        tokenExpiresAt,
        userId: data.user.id,
        userEmail: data.user.email,
        userPlan: data.user.plan
      })
    } catch (err) {
      setConnectionStatus("error")
      setStatusMessage(
        err instanceof Error ? err.message : "Connection failed"
      )
    }
  }, [backendUrl, licenseKey])

  // Open Google OAuth
  const handleGoogleConnect = useCallback(() => {
    if (!userInfo) return
    const url = `${backendUrl}/api/oauth/google?userId=${encodeURIComponent(userInfo.id)}`
    chrome.tabs.create({ url })
  }, [backendUrl, userInfo])

  // Extract sheet ID from URL or raw ID
  const extractSheetId = (input: string): string => {
    const match = input.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : input.trim()
  }

  // Save sheet ID
  const handleSaveSheet = useCallback(async () => {
    if (!sheetId.trim() || !authToken) return

    setSheetSaving(true)
    setSheetStatus("")

    try {
      const parsedSheetId = extractSheetId(sheetId)
      const response = await fetch(`${backendUrl}/api/sheets/configure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ sheetId: parsedSheetId })
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(
          (body as { error?: string }).error || `HTTP ${response.status}`
        )
      }

      setSheetId(parsedSheetId)
      setSheetStatus("Saved")
      await chrome.storage.local.set({ sheetId: parsedSheetId })
    } catch (err) {
      setSheetStatus(
        err instanceof Error ? err.message : "Failed to save"
      )
    } finally {
      setSheetSaving(false)
    }
  }, [backendUrl, authToken, sheetId])

  // Push leads
  const [pushSuccess, setPushSuccess] = useState<boolean | null>(null)

  const handlePush = useCallback(async () => {
    setIsPushing(true)
    setPushStatus("")
    setPushSuccess(null)

    try {
      const response = await chrome.runtime.sendMessage({
        name: "push-leads"
      })
      if (response?.success) {
        setPushStatus(`\u2705 Pushed ${response.pushed} leads`)
        setPushSuccess(true)
      } else {
        setPushStatus(`\u274C ${response?.error || "Push failed"}`)
        setPushSuccess(false)
      }
    } catch (err) {
      setPushStatus(`\u274C ${err instanceof Error ? err.message : "Push failed"}`)
      setPushSuccess(false)
    } finally {
      setIsPushing(false)
    }
  }, [])

  // Toggle auto-approve
  const handleAutoApproveToggle = useCallback(
    (enabled: boolean) => {
      setAutoApprove(enabled)
      chrome.storage.local.set({ autoApproveEnabled: enabled })
    },
    []
  )

  // Push delay
  const handleDelayChange = useCallback((value: number) => {
    setPushDelay(value)
    chrome.storage.local.set({
      pushDelayMin: value * 1000,
      pushDelayMax: value * 1000 + 1000
    })
  }, [])

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const isConnected = connectionStatus === "connected"

  // Onboarding step calculation
  const currentStep = !authToken ? 1 : !googleConnected ? 2 : !sheetId.trim() ? 3 : 4
  const setupComplete = currentStep === 4

  const handleDismissWelcome = () => {
    setShowWelcome(false)
    chrome.storage.local.set({ hasSeenWelcome: true })
  }

  // Welcome screen
  if (showWelcome && welcomeLoaded) {
    return (
      <div className="gc-welcome">
        <div className="gc-welcome-logo">
          <div className="gc-logo-mark" style={{ width: 48, height: 48, borderRadius: 12 }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="8" width="28" height="18" rx="3" fill="#1a1a2e" stroke="#1a1a2e" strokeWidth="2"/>
              <path d="M4 10l12 9 12-9" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="22" cy="8" r="5" fill="#1a1a2e"/>
              <circle cx="26" cy="8" r="5" fill="#1a1a2e"/>
            </svg>
          </div>
          <div className="gc-logo-text" style={{ fontSize: 20 }}>
            <span className="gc-logo-group">group</span>
            <span className="gc-logo-mailbox">mailbox</span>
          </div>
        </div>
        <p className="gc-welcome-desc">
          Capture leads from your Facebook Group and push them to Google Sheets
        </p>
        <div className="gc-welcome-steps">
          <div className="gc-welcome-step">1. Verify your license</div>
          <div className="gc-welcome-step">2. Connect Google Sheets</div>
          <div className="gc-welcome-step">3. Start capturing</div>
        </div>
        <button
          className="gc-btn gc-btn-primary gc-btn-block"
          onClick={handleDismissWelcome}>
          Get Started →
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="gc-header">
        <div className="gc-logo">
          <div className="gc-logo-mark">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="8" width="28" height="18" rx="3" fill="#1a1a2e" stroke="#1a1a2e" strokeWidth="2"/>
              <path d="M4 10l12 9 12-9" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="22" cy="8" r="5" fill="#1a1a2e"/>
              <circle cx="26" cy="8" r="5" fill="#1a1a2e"/>
              <circle cx="24" cy="7" r="3.5" fill="#1a1a2e"/>
            </svg>
          </div>
          <span className="gc-logo-text">
            <span className="gc-logo-group">group</span>
            <span className="gc-logo-mailbox">mailbox</span>
          </span>
          <span className="gc-logo-version">v0.1.0</span>
        </div>
        <div className="gc-logo-tagline">capture. connect. convert.</div>
      </div>

      {/* Network offline banner */}
      {networkStatus === "offline" && (
        <div className="gc-offline-banner">
          You're offline — some features may not work
        </div>
      )}

      {/* Step indicator (hidden when setup complete) */}
      {!setupComplete && (
        <div className="gc-stepper">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="gc-step-wrapper">
              <div
                className={`gc-step ${
                  step < currentStep
                    ? "gc-step-complete"
                    : step === currentStep
                      ? "gc-step-active"
                      : ""
                }`}>
                {step < currentStep ? "\u2713" : step}
              </div>
              {step < 4 && (
                <div
                  className={`gc-step-line ${step < currentStep ? "gc-step-line-complete" : ""}`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Connection Section */}
      <div className="gc-section gc-animate-in">
        <div className="gc-section-title">Connection</div>

        <div className="gc-input-group">
          <label className="gc-input-label">License Key</label>
          <div className="gc-input-row">
            <input
              className="gc-input"
              type="password"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="Enter your license key"
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            />
            <button
              className="gc-btn gc-btn-primary gc-btn-sm"
              onClick={handleVerify}
              disabled={connectionStatus === "checking"}>
              {connectionStatus === "checking" ? (
                <span className="gc-spinner" />
              ) : (
                "Verify"
              )}
            </button>
          </div>
        </div>

        {!isConnected && (
          <div className="gc-helper-text">
            Enter the license key from your purchase confirmation email
          </div>
        )}

        <div className="gc-status-row">
          <span
            className={`gc-status-dot ${
              connectionStatus === "connected"
                ? "connected"
                : connectionStatus === "checking"
                  ? "checking"
                  : "disconnected"
            }`}
            role="status"
            aria-label={`Connection status: ${connectionStatus}`}
          />
          <span className="gc-status-text">
            {statusMessage ||
              (isConnected
                ? `Connected as ${userInfo?.email || "user"}`
                : "Not connected")}
          </span>
          {connectionStatus === "error" && (
            <button className="gc-btn-link" onClick={handleVerify}>Retry</button>
          )}
        </div>
      </div>

      {/* Google Sheets Section */}
      {isConnected && (
        <div className="gc-section gc-animate-in">
          <div className="gc-section-title">Google Sheets</div>

          <div className="gc-google-row">
            <span className="gc-google-icon">
              {googleConnected ? "\u2705" : "\u26A0\uFE0F"}
            </span>
            <span className="gc-status-text">
              {googleConnected
                ? "Google Sheets connected"
                : "Google Sheets not connected"}
            </span>
          </div>

          {!googleConnected && (
            <button
              className="gc-btn gc-btn-secondary gc-btn-block"
              onClick={handleGoogleConnect}>
              Connect Google Sheets
            </button>
          )}

          <div className="gc-input-group" style={{ marginTop: 10 }}>
            <label className="gc-input-label">Sheet URL or ID</label>
            <div className="gc-input-row">
              <input
                className="gc-input"
                type="text"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="Paste your Google Sheet URL"
              />
              <button
                className="gc-btn gc-btn-secondary gc-btn-sm"
                onClick={handleSaveSheet}
                disabled={sheetSaving || !sheetId.trim()}>
                {sheetSaving ? <span className="gc-spinner" /> : "Save"}
              </button>
            </div>
          </div>
          {sheetStatus && (
            <div className="gc-error-row">
              <span className={sheetStatus === "Saved" ? "gc-status-success" : "gc-status-error"}>
                {sheetStatus}
              </span>
              {sheetStatus !== "Saved" && (
                <button className="gc-btn-link" onClick={handleSaveSheet}>Retry</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Setup incomplete warning */}
      {isConnected && (!googleConnected || !sheetId.trim()) && (
        <div className="gc-section gc-animate-in">
          <div className="gc-warning">
            <span className="gc-warning-icon">{"\u26A0"}</span>
            <span className="gc-warning-text">
              {!googleConnected
                ? "Connect Google Sheets above to start capturing leads."
                : "Enter and save a Sheet ID above to start capturing leads."}
            </span>
          </div>
        </div>
      )}

      {/* Leads Section */}
      {isConnected && googleConnected && sheetId.trim() && (
        <div className="gc-section gc-animate-in">
          <div className="gc-section-title">Leads</div>

          <div className="gc-leads-card">
            <div className="gc-leads-count">{leadsCount}</div>
            <div className="gc-leads-label">pending leads</div>
            {lastPushAt && (
              <div className="gc-leads-meta">
                Last push: {lastPushCount} leads at {formatTime(lastPushAt)}
              </div>
            )}
          </div>

          {!onFbPage && (
            <div className="gc-warning">
              <span className="gc-warning-icon">{"\u26A0"}</span>
              <span className="gc-warning-text">
                Navigate to a Facebook Group's member requests page to capture
                leads.
              </span>
            </div>
          )}

          <button
            className="gc-btn gc-btn-primary gc-btn-block"
            onClick={handlePush}
            disabled={isPushing || leadsCount === 0}
            style={{ marginTop: 10 }}>
            {isPushing ? (
              <>
                <span className="gc-spinner" /> Pushing...
              </>
            ) : (
              "Push to Sheets"
            )}
          </button>

          {pushStatus && (
            <div className="gc-error-row">
              <span className={pushSuccess ? "gc-status-success" : pushSuccess === false ? "gc-status-error" : "gc-status-text"}>
                {pushStatus}
              </span>
              {pushSuccess === false && (
                <button className="gc-btn-link" onClick={handlePush}>Retry</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Settings Section */}
      {isConnected && googleConnected && sheetId.trim() && (
        <div className="gc-section gc-animate-in">
          <div className="gc-section-title">Settings</div>

          <div className="gc-setting-row">
            <div className="gc-setting-info">
              <div className="gc-setting-name">Auto-approve new members</div>
              <div className="gc-setting-desc">
                When enabled, new members will be automatically approved when you visit the requests page
              </div>
            </div>
            <label className="gc-switch">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => handleAutoApproveToggle(e.target.checked)}
                aria-label="Auto-approve toggle"
              />
              <span className="gc-switch-track" />
              <span className="gc-switch-thumb" />
            </label>
          </div>

          {autoApprove && (
            <div className="gc-warning">
              <span className="gc-warning-icon">{"\u26A0"}</span>
              <span className="gc-warning-text">
                Auto-approve will click "Approve" on each request with a
                randomized delay. Use with caution -- Facebook may rate-limit
                your account.
              </span>
            </div>
          )}

          <div className="gc-setting-row" style={{ marginTop: 8 }}>
            <div className="gc-setting-info">
              <div className="gc-setting-name">Push Delay</div>
              <div className="gc-setting-desc">Base delay between actions</div>
            </div>
          </div>
          <div className="gc-slider-row">
            <input
              className="gc-slider"
              type="range"
              min={1}
              max={3}
              step={0.5}
              value={pushDelay}
              onChange={(e) => handleDelayChange(Number(e.target.value))}
              aria-label="Push delay in seconds"
              aria-valuemin={1}
              aria-valuemax={3}
              aria-valuenow={pushDelay}
            />
            <span className="gc-slider-value">{pushDelay}s</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="gc-footer">groupmailbox v0.1.0</div>
    </div>
  )
}

export default Popup
