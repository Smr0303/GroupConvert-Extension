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
  const [backendUrl, setBackendUrl] = useState("http://localhost:3000")
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
        "lastPushCount"
      ],
      (result) => {
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
          console.log("[GC] Restored auth from storage, userId:", result.userId)
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
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
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

      // Persist
      await chrome.storage.local.set({
        backendUrl,
        licenseKey: licenseKey.trim(),
        authToken: data.token,
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

  // Save sheet ID
  const handleSaveSheet = useCallback(async () => {
    if (!sheetId.trim() || !authToken) return

    setSheetSaving(true)
    setSheetStatus("")

    try {
      const response = await fetch(`${backendUrl}/api/sheets/configure`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ sheetId: sheetId.trim() })
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(
          (body as { error?: string }).error || `HTTP ${response.status}`
        )
      }

      setSheetStatus("Saved")
      await chrome.storage.local.set({ sheetId: sheetId.trim() })
    } catch (err) {
      setSheetStatus(
        err instanceof Error ? err.message : "Failed to save"
      )
    } finally {
      setSheetSaving(false)
    }
  }, [backendUrl, authToken, sheetId])

  // Push leads
  const handlePush = useCallback(async () => {
    setIsPushing(true)
    setPushStatus("")

    try {
      const response = await chrome.runtime.sendMessage({
        name: "push-leads"
      })
      if (response?.success) {
        setPushStatus(`Pushed ${response.pushed} leads`)
      } else {
        setPushStatus(response?.error || "Push failed")
      }
    } catch (err) {
      setPushStatus(err instanceof Error ? err.message : "Push failed")
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

  return (
    <div>
      {/* Header */}
      <div className="gc-header">
        <div className="gc-logo">
          <div className="gc-logo-mark">G</div>
          <span className="gc-logo-text">GroupConvert</span>
          <span className="gc-logo-version">v0.1.0</span>
        </div>
      </div>

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

        <div className="gc-status-row">
          <span
            className={`gc-status-dot ${
              connectionStatus === "connected"
                ? "connected"
                : connectionStatus === "checking"
                  ? "checking"
                  : "disconnected"
            }`}
          />
          <span className="gc-status-text">
            {statusMessage ||
              (isConnected
                ? `Connected as ${userInfo?.email || "user"}`
                : "Not connected")}
          </span>
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
                placeholder="Paste Google Sheet URL or ID"
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
            <span className="gc-status-text">{sheetStatus}</span>
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
            <div className="gc-status-row" style={{ marginTop: 6 }}>
              <span className="gc-status-text">{pushStatus}</span>
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
              <div className="gc-setting-name">Auto-Approve</div>
              <div className="gc-setting-desc">
                Automatically approve requests after capture
              </div>
            </div>
            <label className="gc-switch">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => handleAutoApproveToggle(e.target.checked)}
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
            />
            <span className="gc-slider-value">{pushDelay}s</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="gc-footer">GroupConvert v0.1.0 -- POC Build</div>
    </div>
  )
}

export default Popup
