# MCPHubs API Reference

> Base URL: `http://<host>:8000`  
> Swagger UI: `http://<host>:8000/docs`

## Authentication

All endpoints (except `/api/health` and `/api/auth/login`) require a Bearer token:

```
Authorization: Bearer <token>
```

Two types of tokens are supported:

| Type | How to get | Expiration |
|------|-----------|------------|
| **JWT** | `POST /api/auth/login` | Configurable (default 24h) |
| **Admin Token** | Settings → Security → Admin Token | Never expires |

---

## Health

### `GET /api/health`

> 🔓 No auth required

Health check and system metrics.

**Response:**
```json
{
  "status": "ok",
  "name": "McpHub",
  "servers_count": 8,
  "exposure_mode": "progressive",
  "total_tools": 49,
  "cpu_percent": 0.2,
  "memory_used_mb": 112.0,
  "memory_total_mb": 7940.0,
  "memory_percent": 1.4
}
```

---

## Auth

### `POST /api/auth/login`

> 🔓 No auth required

**Body:**
```json
{ "username": "admin", "password": "admin123" }
```

**Response:**
```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```

### `POST /api/auth/change-password`

> 🔒 Auth required

**Body:**
```json
{ "old_password": "admin123", "new_password": "newpass" }
```

---

## Servers (CRUD)

### `GET /api/servers`

> 🔒 Auth required

List all registered MCP servers.

### `GET /api/servers/{name}`

> 🔒 Auth required

Get a single server's config.

### `POST /api/servers`

> 🔒 Auth required

Register a new MCP server.

**Body:**
```json
{
  "name": "my-server",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@example/mcp-server"],
  "env": { "API_KEY": "xxx" },
  "description": "My MCP server"
}
```

For SSE/Streamable HTTP transport:
```json
{
  "name": "remote-server",
  "transport": "sse",
  "url": "https://example.com/mcp",
  "headers": { "Authorization": "Bearer xxx" }
}
```

### `PUT /api/servers/{name}`

> 🔒 Auth required

Update a server's config. Same body as POST.

### `DELETE /api/servers/{name}`

> 🔒 Auth required

Unregister a server.

---

## Servers (Tools)

### `GET /api/servers/{name}/tools`

> 🔒 Auth required

List all tools of a server, with disabled status.

**Response:**
```json
{
  "tools": [
    { "name": "search", "description": "...", "inputSchema": {...}, "disabled": false }
  ],
  "disabled_tools": ["some-tool"]
}
```

### `PUT /api/servers/{name}/disabled-tools`

> 🔒 Auth required

Update which tools are disabled.

**Body:**
```json
{ "disabled_tools": ["tool-a", "tool-b"] }
```

---

## Servers (Test & Call)

### `POST /api/servers/{name}/test`

> 🔒 Auth required

Test server connectivity and list tools.

**Response:**
```json
{
  "status": "ok",
  "connected": true,
  "elapsed_ms": 1234,
  "tools_count": 5,
  "tools": [...]
}
```

### `POST /api/servers/{name}/call-tool`

> 🔒 Auth required

Invoke a tool on a server.

**Body:**
```json
{ "tool_name": "search", "arguments": { "query": "hello" } }
```

**Response:**
```json
{
  "status": "ok",
  "elapsed_ms": 500,
  "tool_name": "search",
  "result": [{ "type": "text", "text": "..." }]
}
```

---

## Import / Export

### `GET /api/servers/export?format=generic|claude|vscode`

> 🔒 Auth required

Export all servers as JSON. Formats:
- `generic` — array of server objects
- `claude` — Claude Desktop `mcpServers` format
- `vscode` — VS Code `mcp.servers` format

### `POST /api/servers/import`

> 🔒 Auth required

Import servers from JSON. Auto-detects Claude/VSCode/generic format.

**Body:** Raw JSON in any supported format.

### `POST /api/servers/sync-modelscope`

> 🔒 Auth required

Sync servers from ModelScope MCP Hub.

---

## LLM Description

### `POST /api/servers/{name}/generate-description`

> 🔒 Auth required

Generate a description for a server using LLM.

### `POST /api/servers/analyze-all?force=false`

> 🔒 Auth required

Batch generate descriptions for all servers.

---

## Audit Logs

### `GET /api/audit`

> 🔒 Auth required

Query tool call logs.

**Query params:** `page`, `page_size`, `server_name`, `tool_name`, `status`

**Response:**
```json
{
  "items": [{ "id": 1, "server_name": "...", "tool_name": "...", "status": "ok", ... }],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

### `GET /api/audit/stats`

> 🔒 Auth required

Get audit statistics.

---

## Settings

### `GET /api/settings`

> 🔒 Auth required

Get all settings as key-value pairs.

### `PUT /api/settings/{key}`

> 🔒 Auth required

Update a setting. Allowed keys: `api_key`, `admin_token`, `llm_base_url`, `llm_api_key`, `llm_model`, `modelscope_token`

**Body:**
```json
{ "value": "new-value" }
```

---

## File Manager

### `GET /api/files?path=`

> 🔒 Auth required

List files in a directory.

### `POST /api/files/upload?path=&auto_extract=false`

> 🔒 Auth required

Upload a file. Use `multipart/form-data`.

### `GET /api/files/download?path=`

> 🔒 Auth required

Download a file.

### `GET /api/files/read?path=`

> 🔒 Auth required

Read file content as text.

### `PUT /api/files/write`

> 🔒 Auth required

Write text content to a file.

**Body:**
```json
{ "path": "config.json", "content": "..." }
```

### `POST /api/files/mkdir`

> 🔒 Auth required

Create a directory.

**Body:**
```json
{ "path": "new-folder" }
```

### `DELETE /api/files?path=`

> 🔒 Auth required

Delete a file or directory.

---

## Terminal (WebSocket)

### `WS /api/terminal/ws?token=<token>&cols=120&rows=30`

> 🔒 Auth required (via query param)

WebSocket terminal. Provides a full PTY shell inside the container.

**Client → Server:**
- Text data → stdin
- `{"type":"resize","cols":120,"rows":30}` → resize PTY

**Server → Client:**
- Text data → stdout/stderr

---

## MCP Endpoint

### `POST /mcp`

> 🔑 API Key required (different from Admin Token)

The Streamable HTTP endpoint for AI clients (Claude, Cursor, etc.) to connect.

Auth uses the **API Key** set in Settings → General:
```
Authorization: Bearer <api_key>
```
