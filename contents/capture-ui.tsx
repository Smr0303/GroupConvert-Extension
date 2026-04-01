import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useState, useCallback } from "react"
import { autoApprove } from "~lib/auto-approve"

export const config: PlasmoCSConfig = {
  matches: ["https://www.facebook.com/groups/*/member-requests*"],
  run_at: "document_end"
}

/**
 * Inline styles injected into Shadow DOM so they don't leak
 * into the Facebook page or get overridden by FB styles.
 */
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

    :host {
      all: initial;
      font-family: 'DM Sans', sans-serif;
      --navy: #1a1a2e;
      --teal: #00d4aa;
      --teal-dim: #00b894;
      --text-primary: #f0f0f0;
      --text-muted: #8888a8;
      --red: #ff6b6b;
    }

    .gc-overlay {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .gc-panel {
      background: #1a1a2e;
      border: 1px solid rgba(0, 212, 170, 0.2);
      border-radius: 14px;
      padding: 16px;
      width: 280px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      color: #e0e0e0;
      font-family: 'DM Sans', sans-serif;
    }

    @keyframes gc-slide-up {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .gc-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .gc-panel-title {
      font-size: 13px;
      font-weight: 600;
      color: #00d4aa;
    }

    .gc-close-btn {
      background: none;
      border: none;
      color: #a0a0b8;
      cursor: pointer;
      font-size: 16px;
      padding: 2px 6px;
      border-radius: 4px;
      transition: color 0.15s;
    }

    .gc-close-btn:hover {
      color: #fff;
    }

    .gc-stat {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      font-size: 12px;
      color: #aaa;
    }

    .gc-stat-value {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
    }

    .gc-btn {
      width: 100%;
      padding: 10px 16px;
      border-radius: 8px;
      border: none;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      margin-bottom: 6px;
    }

    .gc-btn-primary {
      background: linear-gradient(135deg, #00d4aa, #00b894);
      color: #1a1a2e;
    }

    .gc-btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 212, 170, 0.3);
    }

    .gc-btn-primary:active {
      transform: translateY(0);
    }

    .gc-btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .gc-btn-danger {
      background: rgba(255, 107, 107, 0.15);
      color: #ff6b6b;
      border: 1px solid rgba(255, 107, 107, 0.2);
    }

    .gc-btn-danger:hover {
      background: rgba(255, 107, 107, 0.25);
    }

    .gc-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
    }

    .gc-toggle-label {
      font-size: 12px;
      color: #ccc;
    }

    .gc-toggle {
      position: relative;
      width: 36px;
      height: 20px;
      cursor: pointer;
    }

    .gc-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .gc-toggle-track {
      position: absolute;
      inset: 0;
      background: #333;
      border-radius: 10px;
      transition: background 0.2s;
    }

    .gc-toggle input:checked + .gc-toggle-track {
      background: #00d4aa;
    }

    .gc-toggle-thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
    }

    .gc-toggle input:checked ~ .gc-toggle-thumb {
      transform: translateX(16px);
    }

    .gc-btn-secondary {
      background: #2d2d52;
      color: #f0f0f0;
      border: 1px solid rgba(255,255,255,0.06);
    }

    .gc-btn-secondary:hover {
      background: rgba(255,255,255,0.08);
    }

    .gc-confirm-overlay {
      background: rgba(26, 26, 46, 0.95);
      border-radius: 10px;
      padding: 16px;
      text-align: center;
      margin-top: 8px;
      border: 1px solid rgba(255, 107, 107, 0.2);
    }

    .gc-confirm-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .gc-confirm-text {
      font-size: 12px;
      color: #a0a0b8;
      margin: 0 0 12px;
      line-height: 1.4;
    }

    .gc-confirm-actions {
      display: flex;
      gap: 8px;
    }

    .gc-confirm-actions .gc-btn {
      flex: 1;
      margin-bottom: 0;
    }

    .gc-status {
      font-size: 11px;
      color: #8888a8;
      margin-top: 4px;
    }

    .gc-status-success {
      color: #00d4aa;
    }

    .gc-status-error {
      color: #ff6b6b;
    }

    .gc-setup-warning {
      background: rgba(255, 217, 61, 0.08);
      border: 1px solid rgba(255, 217, 61, 0.15);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 11px;
      color: #a0a0b8;
      margin-bottom: 8px;
    }

    .gc-settings-link {
      display: block;
      text-align: center;
      font-size: 11px;
      color: #8888a8;
      cursor: pointer;
      padding: 4px;
      margin-top: 4px;
    }

    .gc-settings-link:hover {
      color: #00d4aa;
    }

    .gc-panel-open {
      opacity: 1;
      transform: translateY(0);
      transition: all 0.25s ease-out;
      pointer-events: auto;
    }

    .gc-panel-closed {
      opacity: 0;
      transform: translateY(12px);
      pointer-events: none;
      transition: all 0.2s ease-in;
    }

    .gc-fab {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00d4aa, #00b894);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0, 212, 170, 0.3);
      transition: all 0.2s ease;
      position: relative;
    }

    .gc-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 24px rgba(0, 212, 170, 0.4);
    }

    .gc-fab:active {
      transform: scale(0.96);
    }

    .gc-fab-icon {
      font-size: 22px;
      color: #1a1a2e;
      font-weight: 700;
    }

    .gc-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ff6b6b;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      min-width: 20px;
      height: 20px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
      font-family: 'DM Sans', sans-serif;
      animation: gc-pulse 2s infinite;
    }

    @keyframes gc-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.4); }
      50% { box-shadow: 0 0 0 6px rgba(255, 107, 107, 0); }
    }
  `
  return style
}

/**
 * Plasmo Content Script UI — floating overlay on FB member-requests pages.
 * Rendered inside a Shadow DOM to isolate styles.
 */
const CaptureOverlay = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [leadCount, setLeadCount] = useState(0)
  const [isPushing, setIsPushing] = useState(false)
  const [pushStatus, setPushStatus] = useState("")
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [scrapingStatus, setScrapingStatus] = useState<string>("scanning")
  const [sheetsReady, setSheetsReady] = useState(false)
  const [lastPushInfo, setLastPushInfo] = useState<{ count: number; at: number } | null>(null)

  // Escape key closes the panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  const refreshCount = useCallback(() => {
    chrome.storage.local.get(
      ["pendingLeadsCount", "scrapingStatus", "googleConnected", "sheetId", "lastPushAt", "lastPushCount"],
      (result) => {
        setLeadCount(result.pendingLeadsCount || 0)
        if (result.scrapingStatus) setScrapingStatus(result.scrapingStatus)
        setSheetsReady(!!(result.googleConnected && result.sheetId))
        if (result.lastPushAt) {
          setLastPushInfo({ count: result.lastPushCount || 0, at: result.lastPushAt })
        }
      }
    )
  }, [])

  useEffect(() => {
    refreshCount()
    const interval = setInterval(refreshCount, 2000)

    // Listen for storage changes
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === "local" && changes.pendingLeadsCount) {
        setLeadCount(changes.pendingLeadsCount.newValue || 0)
      }
    }
    chrome.storage.onChanged.addListener(listener)

    return () => {
      clearInterval(interval)
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [refreshCount])

  const handlePush = async () => {
    setIsPushing(true)
    setPushStatus("Pushing leads...")
    try {
      const response = await chrome.runtime.sendMessage({
        name: "push-leads"
      })
      if (response?.success) {
        setPushStatus(`Pushed ${response.pushed} leads`)
        refreshCount()
      } else {
        setPushStatus(`Error: ${response?.error || "Unknown error"}`)
      }
    } catch (err) {
      setPushStatus(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setIsPushing(false)
    }
  }

  const formatTimeAgo = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000)
    if (diff < 60) return "just now"
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return new Date(ts).toLocaleDateString()
  }

  const handleAutoApprove = async () => {
    if (isApproving) return

    setIsApproving(true)
    setPushStatus("Auto-approving...")

    try {
      const result = await autoApprove()
      setPushStatus(
        `Approved ${result.approved}, failed ${result.failed}${result.stopped ? " (stopped)" : ""}`
      )
    } catch (err) {
      setPushStatus(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setIsApproving(false)
    }
  }

  return (
    <div className="gc-overlay">
        <div className={`gc-panel ${isOpen ? "gc-panel-open" : "gc-panel-closed"}`}>
          <div className="gc-panel-header">
            <span className="gc-panel-title">GroupMailBox</span>
            <button
              className="gc-close-btn"
              onClick={() => setIsOpen(false)}
              title="Close"
              aria-label="Close panel">
              x
            </button>
          </div>

          <div className="gc-stat" role="status" aria-live="polite">
            <span className="gc-stat-value">{leadCount}</span>
            <span>
              {scrapingStatus === "scanning"
                ? "Scanning for requests..."
                : scrapingStatus === "no_cards_found"
                  ? "No pending requests found"
                  : "leads captured"}
            </span>
          </div>

          {lastPushInfo && (
            <div className="gc-status" style={{ marginBottom: 8 }}>
              Last push: {lastPushInfo.count} leads, {formatTimeAgo(lastPushInfo.at)}
            </div>
          )}

          {!sheetsReady && (
            <div className="gc-setup-warning">
              {"\u26A0\uFE0F"} Setup incomplete — open side panel to connect Google Sheets
            </div>
          )}

          <button
            className="gc-btn gc-btn-primary"
            onClick={handlePush}
            disabled={isPushing || leadCount === 0 || !sheetsReady}>
            {isPushing ? "Pushing..." : "Push to Sheets"}
          </button>

          <button
            className="gc-btn gc-btn-danger"
            onClick={() => setShowApproveConfirm(true)}
            disabled={isApproving || leadCount === 0}
            aria-label="Approve all pending requests">
            {isApproving ? "Approving..." : "Approve All Now"}
          </button>

          {showApproveConfirm && (
            <div className="gc-confirm-overlay">
              <div className="gc-confirm-icon">{"\u26A0\uFE0F"}</div>
              <p className="gc-confirm-text">
                This will automatically approve all pending member requests. This cannot be undone.
              </p>
              <div className="gc-confirm-actions">
                <button
                  className="gc-btn gc-btn-secondary"
                  onClick={() => setShowApproveConfirm(false)}>
                  Cancel
                </button>
                <button
                  className="gc-btn gc-btn-danger"
                  onClick={() => {
                    setShowApproveConfirm(false)
                    handleAutoApprove()
                  }}>
                  Approve All
                </button>
              </div>
            </div>
          )}

          {pushStatus && <div className="gc-status">{pushStatus}</div>}

          <span className="gc-settings-link" onClick={() => {
            chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" })
          }}>
            Settings
          </span>
        </div>

      <button className="gc-fab" onClick={() => setIsOpen(!isOpen)} aria-label="Open GroupMailBox panel">
        <span className="gc-fab-icon">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="8" width="28" height="18" rx="3" fill="#1a1a2e" stroke="#1a1a2e" strokeWidth="1.5"/>
            <path d="M4 10l12 9 12-9" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="22" cy="8" r="4" fill="#1a1a2e"/>
            <circle cx="26" cy="8" r="4" fill="#1a1a2e"/>
          </svg>
        </span>
        {leadCount > 0 && <span className="gc-badge">{leadCount}</span>}
      </button>
    </div>
  )
}

export default CaptureOverlay
