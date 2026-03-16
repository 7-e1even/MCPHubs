/**
 * McpHub API Client
 * 
 * 封装所有后端 API 调用，带 JWT Token 管理。
 */

// ─── Token 管理 ───────────────────────────────────────────
const TOKEN_KEY = "McpHub_token"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

// ─── Fetch 封装 ───────────────────────────────────────────
async function fetchAPI<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(url, { ...options, headers })

  if (res.status === 401) {
    clearToken()
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
    throw new Error("Unauthorized")
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.error || `HTTP ${res.status}`)
  }

  return res.json()
}

// ─── Auth API ─────────────────────────────────────────────
export interface LoginResponse {
  access_token: string
  token_type: string
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  return fetchAPI<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })
}

export async function changePassword(oldPassword: string, newPassword: string) {
  return fetchAPI("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  })
}

// ─── Health API ───────────────────────────────────────────
export interface HealthResponse {
  status: string
  name: string
  servers_count: number
}

export async function fetchHealth(): Promise<HealthResponse> {
  return fetchAPI<HealthResponse>("/api/health")
}

// ─── Servers API ──────────────────────────────────────────
export interface MCPServer {
  name: string
  transport: string
  command?: string | null
  args?: string[]
  env?: Record<string, string>
  url?: string | null
  headers?: Record<string, string>
  description?: string | null
  status?: string
  error_message?: string | null
}

export async function fetchServers(): Promise<MCPServer[]> {
  return fetchAPI<MCPServer[]>("/api/servers")
}

export async function fetchServer(name: string): Promise<MCPServer> {
  return fetchAPI<MCPServer>(`/api/servers/${encodeURIComponent(name)}`)
}

export async function registerServer(data: {
  name: string
  transport: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  description?: string
}) {
  return fetchAPI("/api/servers", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function deleteServer(name: string) {
  return fetchAPI(`/api/servers/${encodeURIComponent(name)}`, {
    method: "DELETE",
  })
}

export async function updateServer(name: string, data: {
  name: string
  transport: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
  description?: string
}) {
  return fetchAPI(`/api/servers/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

// ─── Import / Export ──────────────────────────────────────
export interface ImportResult {
  imported: { name: string; status: string }[]
  skipped: { name: string; reason: string }[]
  errors: { name: string; error: string }[]
  total_parsed: number
}

export async function importServers(jsonData: unknown): Promise<ImportResult> {
  return fetchAPI<ImportResult>("/api/servers/import", {
    method: "POST",
    body: JSON.stringify(jsonData),
  })
}

export async function exportServers(format: "claude" | "vscode" | "generic" = "generic") {
  return fetchAPI(`/api/servers/export?format=${format}`)
}

// ─── Settings API ─────────────────────────────────────────
export async function getSettings(): Promise<Record<string, string>> {
  return fetchAPI<Record<string, string>>("/api/settings")
}

export async function updateSetting(key: string, value: string) {
  return fetchAPI(`/api/settings/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  })
}

// ─── Description Generation ───────────────────────────────
export async function generateDescription(name: string): Promise<{ status: string; description: string }> {
  return fetchAPI(`/api/servers/${encodeURIComponent(name)}/generate-description`, {
    method: "POST",
  })
}

// ─── Bulk LLM Analysis ───────────────────────────────────
export interface AnalyzeAllResult {
  success: { name: string; description: string }[]
  skipped: { name: string; reason: string }[]
  errors: { name: string; error: string }[]
}

export async function analyzeAllServers(force: boolean = false): Promise<AnalyzeAllResult> {
  return fetchAPI<AnalyzeAllResult>(`/api/servers/analyze-all?force=${force}`, {
    method: "POST",
  })
}

// ─── ModelScope Sync ──────────────────────────────────────
export async function syncModelScope(): Promise<ImportResult> {
  return fetchAPI<ImportResult>("/api/servers/sync-modelscope", {
    method: "POST",
  })
}

// ─── Audit Logs API ──────────────────────────────────────
export interface AuditLog {
  id: number
  server_name: string
  tool_name: string
  arguments: string | null
  result_preview: string | null
  status: string
  error_message: string | null
  duration_ms: number
  created_at: string
}

export interface AuditLogsResponse {
  items: AuditLog[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface AuditStats {
  total: number
  success: number
  errors: number
  by_server: { server_name: string; count: number }[]
}

export async function fetchAuditLogs(params: {
  page?: number
  page_size?: number
  server_name?: string
  tool_name?: string
  status?: string
} = {}): Promise<AuditLogsResponse> {
  const q = new URLSearchParams()
  if (params.page) q.set("page", String(params.page))
  if (params.page_size) q.set("page_size", String(params.page_size))
  if (params.server_name) q.set("server_name", params.server_name)
  if (params.tool_name) q.set("tool_name", params.tool_name)
  if (params.status) q.set("status", params.status)
  return fetchAPI<AuditLogsResponse>(`/api/audit?${q.toString()}`)
}

export async function fetchAuditStats(): Promise<AuditStats> {
  return fetchAPI<AuditStats>("/api/audit/stats")
}

// ─── Debug / Test API ─────────────────────────────────────
export interface ToolInfo {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface TestResult {
  status: string
  connected: boolean
  elapsed_ms: number
  tools_count: number
  tools: ToolInfo[]
  error?: string
}

export interface CallToolResult {
  status: string
  elapsed_ms: number
  tool_name: string
  result?: { type: string; text?: string; data?: string }[]
  error?: string
}

export async function testServer(name: string): Promise<TestResult> {
  return fetchAPI<TestResult>(`/api/servers/${encodeURIComponent(name)}/test`, {
    method: "POST",
  })
}

export async function callServerTool(
  name: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<CallToolResult> {
  return fetchAPI<CallToolResult>(
    `/api/servers/${encodeURIComponent(name)}/call-tool`,
    {
      method: "POST",
      body: JSON.stringify({ tool_name: toolName, arguments: args }),
    }
  )
}
