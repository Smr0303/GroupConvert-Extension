/**
 * Backend API client for GroupMailBox.
 * Wraps fetch calls to the backend Express server.
 */

const API_BASE =
  process.env.PLASMO_PUBLIC_BACKEND_URL || "http://localhost:3000"

interface VerifyLicenseResponse {
  token: string
  user: {
    id: string
    email: string
    plan: string
  }
}

interface PushLeadsResponse {
  pushed: number
  failed: number
  errors?: string[]
}

interface ConfigureSheetResponse {
  success: boolean
  sheetTitle?: string
}

interface LeadPayload {
  name: string
  profileUrl: string
  answers: Array<{ question: string; answer: string }>
  capturedAt: number
  groupUrl?: string
}

/**
 * Check if the stored JWT token has expired.
 */
export async function isTokenExpired(): Promise<boolean> {
  const result = await chrome.storage.local.get("tokenExpiresAt")
  return Date.now() > (result.tokenExpiresAt || 0)
}

/**
 * Clear auth state and signal re-auth needed.
 */
export async function clearAuthState(): Promise<void> {
  await chrome.storage.local.remove([
    "authToken",
    "tokenExpiresAt",
    "userId",
    "userEmail",
    "userPlan"
  ])
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>)
  }

  // Check token expiry for authenticated requests
  if (headers.Authorization) {
    const expired = await isTokenExpired()
    if (expired) {
      await clearAuthState()
      throw new Error("Your session has expired. Please re-verify your license.")
    }
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers
    })
  } catch (err) {
    if (!navigator.onLine) {
      throw new Error("You appear to be offline. Check your internet connection and try again.")
    }
    throw new Error("Unable to reach GroupMailBox server. Please try again in a moment.")
  }

  // Handle 401 - trigger re-auth
  if (response.status === 401) {
    await clearAuthState()
    throw new Error("Your session has expired. Please re-verify your license.")
  }

  if (!response.ok) {
    const body = await response.text()
    let message: string
    try {
      const json = JSON.parse(body)
      message = json.error || json.message || body
    } catch {
      message = body || `HTTP ${response.status}`
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

/**
 * Verify a license key against the backend.
 * Returns a JWT token and user info on success.
 */
export async function verifyLicense(
  licenseKey: string,
  backendUrl?: string
): Promise<VerifyLicenseResponse> {
  const base = backendUrl || API_BASE
  const url = `${base}/api/auth/verify-license`

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseKey })
  })

  if (!response.ok) {
    const body = await response.text()
    let message: string
    try {
      const json = JSON.parse(body)
      message = json.error || json.message || body
    } catch {
      message = body || `HTTP ${response.status}`
    }
    throw new Error(message)
  }

  return response.json() as Promise<VerifyLicenseResponse>
}

/**
 * Push an array of leads to the backend for writing to Google Sheets.
 */
export async function pushLeads(
  token: string,
  leads: LeadPayload[],
  backendUrl?: string
): Promise<PushLeadsResponse> {
  const base = backendUrl || API_BASE
  const url = `${base}/api/leads`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token)
    },
    body: JSON.stringify({ leads })
  })

  if (!response.ok) {
    const body = await response.text()
    let message: string
    try {
      const json = JSON.parse(body)
      message = json.error || json.message || body
    } catch {
      message = body || `HTTP ${response.status}`
    }
    throw new Error(message)
  }

  return response.json() as Promise<PushLeadsResponse>
}

/**
 * Configure which Google Sheet to write leads into.
 */
export async function configureSheet(
  token: string,
  sheetId: string,
  backendUrl?: string
): Promise<ConfigureSheetResponse> {
  const base = backendUrl || API_BASE

  return request<ConfigureSheetResponse>(`/api/sheets/configure`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ sheetId })
  })
}

/**
 * Get the Google OAuth URL for the user to authorize Sheets access.
 */
export function getGoogleAuthUrl(
  userId: string,
  backendUrl?: string
): string {
  const base = backendUrl || API_BASE
  return `${base}/api/oauth/google?userId=${encodeURIComponent(userId)}`
}

/**
 * Check backend health / connectivity.
 */
export async function checkHealth(
  backendUrl?: string
): Promise<{ status: string }> {
  const base = backendUrl || API_BASE
  const url = `${base}/api/health`

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  })

  if (!response.ok) {
    throw new Error(`Backend unreachable (HTTP ${response.status})`)
  }

  return response.json() as Promise<{ status: string }>
}
