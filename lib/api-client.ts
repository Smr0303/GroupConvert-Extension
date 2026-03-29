/**
 * Backend API client for GroupConvert.
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

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>)
  }

  const response = await fetch(url, {
    ...options,
    headers
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
