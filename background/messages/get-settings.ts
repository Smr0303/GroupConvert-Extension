import type { PlasmoMessaging } from "@plasmohq/messaging"

/**
 * Plasmo message handler: get-settings
 * Returns stored extension settings to the caller.
 */

interface GetSettingsResponse {
  backendUrl?: string
  authToken?: string
  userId?: string
  licenseKey?: string
  sheetId?: string
  autoApproveEnabled?: boolean
  pushDelayMin?: number
  pushDelayMax?: number
  googleConnected?: boolean
  lastPushAt?: number
  lastPushCount?: number
  pendingLeadsCount?: number
  onMemberRequestsPage?: boolean
}

const handler: PlasmoMessaging.MessageHandler<
  Record<string, never>,
  GetSettingsResponse
> = async (_req, res) => {
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
    "lastPushCount",
    "pendingLeadsCount",
    "onMemberRequestsPage"
  ])

  res.send(result as GetSettingsResponse)
}

export default handler
