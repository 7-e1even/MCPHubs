# MCPHubs

**不让 AI 被工具定义淹没的 MCP 网关。**

[English](./README.md)

---

## 为什么需要 MCPHubs？

MCP 协议很强大——但暴力聚合不是。当你接入 10+ 个 MCP Server 时，大模型的系统提示词中会被塞入上百条工具定义，每一次请求都要承担这笔开销：

- 🔥 **Token 浪费严重** — 工具 schema 本身就消耗数千 Token
- 🤯 **选择困难** — 工具越多，大模型的调用准确率越低
- 💸 **成本飙升** — 每次请求都在为臃肿的提示词买单

**MCPHubs 通过"渐进式披露"解决这个问题。**

不再把所有工具一股脑塞给大模型，MCPHubs 只暴露 **4 个元工具**。AI 按需发现服务、查看能力、调用工具——零前置开销。

```
┌─────────────────────────────────────────────────────────────────────┐
│                         没有 MCPHubs                                │
│                                                                     │
│  AI 系统提示词:                                                      │
│  ├── tool_1 定义 (搜索)                      }                      │
│  ├── tool_2 定义 (抓取文章)                   }  150 个工具 schema   │
│  ├── tool_3 定义 (创建 issue)                }  ≈ 8,000 tokens      │
│  ├── ...                                     }  每次请求都要付出     │
│  └── tool_150 定义 (运行分析)                 }                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          有了 MCPHubs                               │
│                                                                     │
│  AI 系统提示词:                                                      │
│  ├── list_servers    "发现可用的服务"          }                      │
│  ├── list_tools      "查看某个服务的工具"      }  4 个工具            │
│  ├── call_tool       "调用任意工具"            }  ≈ 400 tokens       │
│  └── refresh_tools   "刷新工具缓存"           }  每次请求仅此而已    │
│                                                                     │
│  AI 在需要时才去发现和调用工具，而非提前全部加载。                        │
└─────────────────────────────────────────────────────────────────────┘
```

<img src="./assets/dashboard.png" alt="MCPHubs Dashboard" width="800">

## 渐进式披露如何工作

MCPHubs 将所有 MCP Server 收敛为 **4 个元工具**：

| 元工具 | 作用 |
|---|---|
| `list_servers` | 发现所有可用的 MCP Server |
| `list_tools` | 查看指定 Server 提供的工具 |
| `call_tool` | 统一调用入口，调用任意 Server 上的任意工具 |
| `refresh_tools` | 刷新指定 Server 的工具缓存 |

AI 的使用流程：`list_servers` 看看有哪些服务 → `list_tools` 了解某个服务的能力 → `call_tool` 精准调用。不提前暴露，不浪费 Token。

> 不需要渐进式模式？设置 `MCPHUBS_EXPOSURE_MODE=full`，MCPHubs 将直接透传所有工具。

## ✨ 特性

| | |
|---|---|
| 🎯 **渐进式披露** | 4 个元工具，无限能力。工具按需加载 |
| 🔀 **多协议网关** | 统一聚合 stdio、SSE、Streamable HTTP |
| 🖥️ **Web 看板** | 基于 Next.js 的现代管理界面，支持批量导入导出 |
| 📦 **一键导入** | 自动识别 Claude Desktop / VS Code / 通用 JSON 格式 |
| 🤖 **LLM 自动摘要** | 接入任意兼容 OpenAI 的接口，自动为 Server 生成描述 |
| 🔐 **API Key 认证** | 通过 Bearer Token 保护 `/mcp` 端点 |
| 🌟 **ModelScope 同步** | 从 [魔搭社区 MCP 广场](https://modelscope.cn/home) 一键导入 |

### ModelScope 集成

<img src="./assets/ModelScope.png" alt="ModelScope 集成" width="800">

## 🏗 架构

```
AI 客户端 ──▶ Streamable HTTP ──▶ MCPHubs 网关 ──┬─ stdio 服务
                                      │           ├─ SSE 服务
                                 PostgreSQL        └─ HTTP 服务
                                      │
                                 Web 管理控制台
```

## 🚀 快速开始

### Docker Compose（推荐）

```bash
git clone https://github.com/7-e1even/MCPHubs.git && cd MCPHubs
cp .env.example .env        # 根据需要修改配置
docker compose up -d
```

打开 `http://localhost:3000` — 使用 `admin` / `admin123` 登录。

### 本地开发

**后端：**

```bash
pip install -r requirements.txt
cp .env.example .env
python main.py serve
```

**前端（开发环境）：**

```bash
cd web
npm install
npm run dev
```

**前端（生产部署）：**

```bash
cd web && npm install && npm run build && npm run start
```

## 🔌 接入 AI 客户端

将 MCPHubs 作为唯一的 MCP 端点添加：

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

如果配置了 API Key 认证：

```bash
claude mcp add --transport http --header "Authorization: Bearer 你的_API_KEY" mcphubs http://localhost:3000/mcp
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

就这样。你的 AI 现在可以通过渐进式发现访问**所有 Server 上的所有工具**——而不用提前看到任何一个。

## ⚙️ 环境变量

| 变量名 | 默认值 | 说明 |
|---|---|---|
| `MCPHUBS_EXPOSURE_MODE` | `progressive` | `progressive`（渐进式）或 `full`（全量透传） |
| `MCPHUBS_DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL 连接字符串 |
| `MCPHUBS_API_KEY` | *（空）* | `/mcp` 端点的 Bearer Token（留空则不开启认证） |
| `MCPHUBS_HOST` | `0.0.0.0` | 监听地址 |
| `MCPHUBS_PORT` | `8000` | 监听端口 |
| `MCPHUBS_JWT_SECRET` | *（随机生成）* | 后台登录的 JWT 签名密钥 |
| `MCPHUBS_ADMIN_USERNAME` | `admin` | 管理员账号 |
| `MCPHUBS_ADMIN_PASSWORD` | `admin123` | 管理员密码 |

## 📡 管理 API

```bash
# 获取所有 server 列表
curl http://localhost:8000/api/servers

# 注册新的 server
curl -X POST http://localhost:8000/api/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{"name": "my-server", "transport": "sse", "url": "http://10.0.0.5:3000/sse"}'

# 导出配置 (支持 claude / vscode / generic)
curl http://localhost:8000/api/servers/export?format=claude

# 探活接口
curl http://localhost:8000/api/health
```

## 📄 开源协议

[MIT](LICENSE)
