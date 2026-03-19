<p align="center">
  <img src="./assets/dashboard.png" alt="MCPHubs Dashboard" width="720">
</p>

<h1 align="center">MCPHubs</h1>

<p align="center">
  <strong>The MCP gateway that doesn't overwhelm your AI.</strong>
</p>

<p align="center">
  <a href="https://github.com/7-e1even/MCPHubs/blob/main/LICENSE"><img src="https://img.shields.io/github/license/7-e1even/MCPHubs?style=flat-square&color=blue" alt="License"></a>
  <a href="https://github.com/7-e1even/MCPHubs/releases"><img src="https://img.shields.io/github/v/release/7-e1even/MCPHubs?style=flat-square&color=green" alt="Release"></a>
  <a href="https://github.com/7-e1even/MCPHubs/stargazers"><img src="https://img.shields.io/github/stars/7-e1even/MCPHubs?style=flat-square&color=yellow" alt="Stars"></a>
  <a href="https://github.com/7-e1even/MCPHubs"><img src="https://img.shields.io/badge/python-%3E%3D3.11-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python"></a>
  <a href="https://github.com/7-e1even/MCPHubs"><img src="https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js&logoColor=white" alt="Next.js"></a>
</p>

<p align="center">
  <a href="./README_zh.md">中文文档</a> · <a href="#-quick-start">Quick Start</a> · <a href="#-connect-your-ai-client">Connect AI</a> · <a href="#%EF%B8%8F-configuration">Configuration</a>
</p>

---

## The Problem

MCP is powerful — but naive aggregation is not. When you wire up 10+ MCP Servers, your LLM is force-fed hundreds of tool definitions on **every single request** — burning tokens, inflating costs, and degrading decision quality.

## The Solution: Progressive Disclosure

Instead of dumping every tool into the system prompt, MCPHubs exposes a lean surface of just **3 meta-tools**. Your AI discovers servers, inspects their capabilities, and calls the right tool — all on demand, with zero upfront overhead.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Without MCPHubs                              │
│                                                                     │
│  AI System Prompt:                                                  │
│  ├── tool_1 definition (search)              }                      │
│  ├── tool_2 definition (fetch_article)       }  150 tool schemas    │
│  ├── tool_3 definition (create_issue)        }  = ~8,000 tokens     │
│  ├── ...                                     }  EVERY request       │
│  └── tool_150 definition (run_analysis)      }                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         With MCPHubs                                │
│                                                                     │
│  AI System Prompt:                                                  │
│  ├── list_servers    "discover servers (with search)" }              │
│  ├── list_tools      "inspect a server's tools"      }  3 tools     │
│  └── call_tool       "invoke any tool"               }  ≈ 300 tokens│
│                                                                     │
│  AI discovers and calls the right tool when needed. Not before.     │
└─────────────────────────────────────────────────────────────────────┘
```

## How It Works

MCPHubs collapses all your MCP Servers into **3 meta-tools**:

| Meta-Tool      | Purpose                                                          |
| -------------- | ---------------------------------------------------------------- |
| `list_servers` | Discover MCP Servers (supports fuzzy search by name/description) |
| `list_tools`   | Inspect tools on a specific server                               |
| `call_tool`    | Invoke any tool on any server                                    |

The AI explores your tool ecosystem **on demand** — it calls `list_servers` to see what's available, drills into a server with `list_tools`, and invokes the right tool via `call_tool`. No upfront cost, no bloat.

> **Scales to hundreds of servers.** `list_servers` returns up to 20 results by default, along with the total count. When the AI sees more servers exist than shown, it automatically narrows results with the optional `query` parameter — no extra tools needed.

> Don't need progressive disclosure? Set `MCPHUBS_EXPOSURE_MODE=full` and MCPHubs becomes a straightforward aggregation gateway — all tools from all servers exposed directly.

## ✨ Features

|                              |                                                                      |
| ---------------------------- | -------------------------------------------------------------------- |
| 🎯 **Progressive Disclosure** | 3 meta-tools, infinite capabilities. Tools loaded on demand          |
| 🔀 **Multi-Protocol Gateway** | Unifies stdio, SSE, and Streamable HTTP behind one endpoint          |
| 🖥️ **Web Dashboard**          | Modern Next.js UI for managing servers, bulk import/export           |
| 📦 **One-Click Import**       | Auto-detects Claude Desktop, VS Code, and generic JSON configs       |
| 🤖 **LLM Descriptions**       | Auto-generates server summaries via OpenAI-compatible APIs           |
| 🔐 **API Key Auth**           | Bearer Token protection on the `/mcp` endpoint                       |
| 🌟 **ModelScope Sync**        | Import from [ModelScope MCP Marketplace](https://modelscope.cn/home) |

<details>
<summary><b>🌟 ModelScope Integration</b></summary>
<br>
<img src="./assets/ModelScope.png" alt="ModelScope Integration" width="720">
</details>

## 🏗 Architecture

```
AI Client ──▶ Streamable HTTP ──▶ MCPHubs Gateway ──┬─ stdio servers
                                       │            ├─ SSE servers
                                  PostgreSQL         └─ HTTP servers
                                       │
                                  Web Dashboard
```

## 💻 CLI

Call MCP tools directly from your terminal — no AI client needed.

```bash
npm i -g mcphubs
mcphubs config --url http://localhost:8000 --token "YOUR_ADMIN_TOKEN"
```

```bash
# Install and manage servers
mcphubs install github -e GITHUB_TOKEN=xxx -- npx -y @modelcontextprotocol/server-github
mcphubs install --transport sse remote-server http://example.com/sse
mcphubs install --from claude_desktop_config.json
mcphubs remove github

# Call and run
mcphubs list                                        # List all servers
mcphubs tools github                                # List tools for a server
mcphubs call github.search_repositories query=test  # Call a tool
```

> The CLI uses the **Admin Token** (Settings → Security), not the MCP API Key. See [CLI docs](./cli/SKILL.md) for details.

## 🚀 Quick Start

### Docker Compose (Recommended)

```bash
git clone https://github.com/7-e1even/MCPHubs.git && cd MCPHubs
cp .env.example .env        # edit as needed
docker compose up -d
```

Open `http://localhost:3000` — login with `admin` / `admin123`.

### Local Development

<details>
<summary><b>Backend</b></summary>

```bash
pip install -r requirements.txt
cp .env.example .env
python main.py serve
```

</details>

<details>
<summary><b>Frontend (dev)</b></summary>

```bash
cd web
npm install
npm run dev
```

</details>

<details>
<summary><b>Frontend (production)</b></summary>

```bash
cd web && npm install && npm run build && npm run start
```

</details>

## 🔌 Connect Your AI Client

Add MCPHubs as a single MCP endpoint:

### Cursor / Windsurf

```json
{
  "mcpServers": {
    "mcphubs": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Claude Code

```bash
claude mcp add --transport http mcphubs http://localhost:3000/mcp
```

With API Key authentication:

```bash
claude mcp add --transport http --header "Authorization: Bearer YOUR_API_KEY" mcphubs http://localhost:3000/mcp
```

### VS Code

```json
{
  "mcp": {
    "servers": {
      "mcphubs": {
        "type": "streamable-http",
        "url": "http://localhost:3000/mcp"
      }
    }
  }
}
```

That's it. Your AI now has access to **every tool on every server** through progressive discovery — without seeing any of them upfront.

## ⚙️ Configuration

| Variable                 | Default                    | Description                                          |
| ------------------------ | -------------------------- | ---------------------------------------------------- |
| `MCPHUBS_EXPOSURE_MODE`  | `progressive`              | `progressive` (3 meta-tools) or `full` (passthrough) |
| `MCPHUBS_DATABASE_URL`   | `postgresql+asyncpg://...` | PostgreSQL connection string                         |
| `MCPHUBS_API_KEY`        | *(empty)*                  | Bearer Token for `/mcp` (empty = no auth)            |
| `MCPHUBS_HOST`           | `0.0.0.0`                  | Listen address                                       |
| `MCPHUBS_PORT`           | `8000`                     | Listen port                                          |
| `MCPHUBS_JWT_SECRET`     | *(random)*                 | JWT signing secret for dashboard                     |
| `MCPHUBS_ADMIN_USERNAME` | `admin`                    | Dashboard admin username                             |
| `MCPHUBS_ADMIN_PASSWORD` | `admin123`                 | Dashboard admin password                             |

## 📡 Management API

<details>
<summary><b>View API examples</b></summary>

```bash
# List all servers
curl http://localhost:8000/api/servers

# Register a new server
curl -X POST http://localhost:8000/api/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{"name": "my-server", "transport": "sse", "url": "http://10.0.0.5:3000/sse"}'

# Export config (claude / vscode / generic)
curl http://localhost:8000/api/servers/export?format=claude

# Health check
curl http://localhost:8000/api/health
```

</details>

## 🤝 Contributing

Contributions are welcome! Feel free to open issues and pull requests.

## 📄 License

[MIT](LICENSE)
