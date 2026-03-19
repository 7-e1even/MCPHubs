/**
 * MCPHubs HTTP Client
 *
 * Thin wrapper around the MCPHubs REST API.
 */

export class MCPHubsClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.token = token;
  }

  private async request<T = any>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e: any) {
      console.error(`✗ Cannot reach MCPHubs at ${this.baseUrl}`);
      console.error(`  ${e.message}`);
      process.exit(1);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let detail = text;
      try {
        detail = JSON.parse(text).detail || text;
      } catch {}
      console.error(`✗ API ${res.status}: ${detail}`);
      process.exit(1);
    }

    return res.json() as Promise<T>;
  }

  /** GET /api/servers */
  async listServers(): Promise<any[]> {
    return this.request("GET", "/api/servers");
  }

  /** GET /api/servers/{name}/tools */
  async listTools(server: string): Promise<any> {
    return this.request("GET", `/api/servers/${encodeURIComponent(server)}/tools`);
  }

  /** POST /api/servers/{name}/call-tool */
  async callTool(
    server: string,
    toolName: string,
    args: Record<string, any>
  ): Promise<any> {
    return this.request(
      "POST",
      `/api/servers/${encodeURIComponent(server)}/call-tool`,
      { tool_name: toolName, arguments: args }
    );
  }
}
