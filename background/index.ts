/**
 * Background service worker for GroupMailBox.
 * Handles messaging between content scripts and side panel.
 */

export {}

// Open the side panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.name === "push-leads") {
    handlePushLeads().then(sendResponse).catch((err) => {
      sendResponse({ success: false, error: err.message })
    })
    return true // async
  }

  if (message.name === "get-settings") {
    handleGetSettings().then(sendResponse)
    return true
  }

  if (message.type === "OPEN_SIDE_PANEL") {
    if (sender.tab?.windowId) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId })
    }
    sendResponse({ success: true })
    return true
  }
})

async function handlePushLeads(): Promise<{
  success: boolean
  pushed?: number
  error?: string
}> {
  try {
    const storage = await chrome.storage.local.get([
      "pendingLeads",
      "authToken",
      "backendUrl"
    ])

    const leads = storage.pendingLeads || []
    const token = storage.authToken
    const backendUrl =
      storage.backendUrl ||
      process.env.PLASMO_PUBLIC_BACKEND_URL ||
      "http://localhost:3000"

    if (!token) {
      return { success: false, error: "Not authenticated. Verify license in popup." }
    }

    if (leads.length === 0) {
      return { success: false, error: "No leads to push" }
    }

    const response = await fetch(`${backendUrl}/api/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ leads })
    })

    if (!response.ok) {
      const body = await response.text()
      let errorMsg: string
      try {
        const json = JSON.parse(body)
        errorMsg = json.error || json.message || body
      } catch {
        errorMsg = body || `HTTP ${response.status}`
      }
      return { success: false, error: errorMsg }
    }

    const result = await response.json()

    // Clear pushed leads from storage
    await chrome.storage.local.set({
      pendingLeads: [],
      pendingLeadsCount: 0,
      lastPushAt: Date.now(),
      lastPushCount: result.pushed || leads.length
    })

    return { success: true, pushed: result.pushed || leads.length }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

async function handleGetSettings(): Promise<Record<string, unknown>> {
  const result = await chrome.storage.local.get([
    "backendUrl",
    "authToken",
    "userId",
    "licenseKey",
    "sheetId",
    "autoApproveEnabled",
    "pushDelayMin",
    "pushDelayMax",
    "googleConnected",
    "lastPushAt",
    "lastPushCount"
  ])
  return result
}

console.log("[GroupMailBox] Background service worker loaded")
