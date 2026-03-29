import type { PlasmoMessaging } from "@plasmohq/messaging"

/**
 * Plasmo message handler: push-leads
 * Receives leads from content script, posts to backend API.
 */

interface PushLeadsRequest {
  leads?: Array<{
    name: string
    profileUrl: string
    answers: Array<{ question: string; answer: string }>
    capturedAt: number
    groupUrl?: string
  }>
}

interface PushLeadsResponse {
  success: boolean
  pushed?: number
  failed?: number
  error?: string
}

const handler: PlasmoMessaging.MessageHandler<
  PushLeadsRequest,
  PushLeadsResponse
> = async (req, res) => {
  try {
    const storage = await chrome.storage.local.get([
      "pendingLeads",
      "authToken",
      "backendUrl"
    ])

    const leads = req.body?.leads || storage.pendingLeads || []
    const token = storage.authToken as string | undefined
    const backendUrl =
      (storage.backendUrl as string) || "http://localhost:3000"

    if (!token) {
      res.send({
        success: false,
        error: "Not authenticated. Verify license in popup first."
      })
      return
    }

    if (leads.length === 0) {
      res.send({ success: false, error: "No leads to push" })
      return
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
      res.send({ success: false, error: errorMsg })
      return
    }

    const result = (await response.json()) as {
      pushed?: number
      failed?: number
    }

    // Clear pushed leads
    await chrome.storage.local.set({
      pendingLeads: [],
      pendingLeadsCount: 0,
      lastPushAt: Date.now(),
      lastPushCount: result.pushed || leads.length
    })

    res.send({
      success: true,
      pushed: result.pushed || leads.length,
      failed: result.failed || 0
    })
  } catch (err) {
    res.send({
      success: false,
      error: err instanceof Error ? err.message : String(err)
    })
  }
}

export default handler
