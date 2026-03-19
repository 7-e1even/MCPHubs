<p align="center">
  <img src="./assets/dashboard.png" alt="MCPHubs Dashboard" width="720">
</p>

<h1 align="center">MCPHubs</h1>

<p align="center">
  <strong>不让 AI 被工具定义淹没的 MCP 网关。</strong>
</p>

<p align="center">
  <a href="https://github.com/7-e1even/MCPHubs/blob/main/LICENSE"><img src="https://img.shields.io/github/license/7-e1even/MCPHubs?style=flat-square&color=blue" alt="License"></a>
  <a href="https://github.com/7-e1even/MCPHubs/releases"><img src="https://img.shields.io/github/v/release/7-e1even/MCPHubs?style=flat-square&color=green" alt="Release"></a>
  <a href="https://github.com/7-e1even/MCPHubs/stargazers"><img src="https://img.shields.io/github/stars/7-e1even/MCPHubs?style=flat-square&color=yellow" alt="Stars"></a>
  <a href="https://github.com/7-e1even/MCPHubs"><img src="https://img.shields.io/badge/python-%3E%3D3.11-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python"></a>
  <a href="https://github.com/7-e1even/MCPHubs"><img src="https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js&logoColor=white" alt="Next.js"></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="#-快速开始">快速开始</a> · <a href="#-接入-ai-客户端">接入 AI</a> · <a href="#%EF%B8%8F-环境变量">配置</a>
</p>

---

## 痛点

MCP 协议很强大——但暴力聚合不是。当你接入 10+ 个 MCP Server 时，大模型的系统提示词中会被塞入上百条工具定义，**每一次请求**都要承担这笔开销：

- 🔥 **Token 浪费严重** — 工具 schema 本身就消耗数千 Token
- 🤯 **选择困难** — 工具越多，大模型的调用准确率越低
- 💸 **成本飙升** — 每次请求都在为臃肿的提示词买单

## 解决方案：渐进式披露

不再把所有工具一股脑塞给大模型，MCPHubs 只暴露 **3 个元工具**。AI 按需发现服务、查看能力、调用工具——零前置开销。

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
│  ├── list_servers    "发现服务（支持搜索）"    }                      │
│  ├── list_tools      "查看某个服务的工具"      }  3 个工具            │
│  └── call_tool       "调用任意工具"            }  ≈ 300 tokens       │
│                                                                     │
│  AI 在需要时才去发现和调用工具，而非提前全部加载。                        │
└─────────────────────────────────────────────────────────────────────┘
```

## 工作原理

MCPHubs 将所有 MCP Server 收敛为 **3 个元工具**：

| 元工具 | 作用 |
|---|---|
| `list_servers` | 发现可用的 MCP Server（支持按名称/描述模糊搜索） |
| `list_tools` | 查看指定 Server 提供的工具 |
| `call_tool` | 统一调用入口，调用任意 Server 上的任意工具 |

AI 的使用流程：`list_servers` 看看有哪些服务 → `list_tools` 了解某个服务的能力 → `call_tool` 精准调用。不提前暴露，不浪费 Token。

> **支持百级 Server 规模。** `list_servers` 默认返回前 20 个结果和总数。当 AI 发现 total 大于返回数量时，会自动通过可选的 `query` 参数缩小范围——无需额外工具。

> 不需要渐进式模式？设置 `MCPHUBS_EXPOSURE_MODE=full`，MCPHubs 将直接透传所有工具。

## ✨ 特性

| | |
|---|---|
| 🎯 **渐进式披露** | 3 个元工具，无限能力。工具按需加载 |
| 🔀 **多协议网关** | 统一聚合 stdio、SSE、Streamable HTTP |
| 🖥️ **Web 看板** | 基于 Next.js 的现代管理界面，支持批量导入导出 |
| 📦 **一键导入** | 自动识别 Claude Desktop / VS Code / 通用 JSON 格式 |
| 🤖 **LLM 自动摘要** | 接入任意兼容 OpenAI 的接口，自动为 Server 生成描述 |
| 🔐 **API Key 认证** | 通过 Bearer Token 保护 `/mcp` 端点 |
| 🌟 **ModelScope 同步** | 从 [魔搭社区 MCP 广场](https://modelscope.cn/home) 一键导入 |

<details>
<summary><b>🌟 ModelScope 集成</b></summary>
<br>
<img src="./assets/ModelScope.png" alt="ModelScope 集成" width="720">
</details>

## 🏗 架构

```
AI 客户端 ──▶ Streamable HTTP ──▶ MCPHubs 网关 ──┬─ stdio 服务
                                      │           ├─ SSE 服务
                                 PostgreSQL        └─ HTTP 服务
                                      │
                                 Web 管理控制台
```

## 💻 CLI

在终端直接调用 MCP 工具，无需启动 AI 客户端。

```bash
npm i -g mcphubs
mcphubs config --url http://localhost:8000 --token "你的_ADMIN_TOKEN"
```

```bash
# 安装与管理 Server
mcphubs install github -e GITHUB_TOKEN=xxx -- npx -y @modelcontextprotocol/server-github
mcphubs install --transport sse remote-server http://example.com/sse
mcphubs install --from claude_desktop_config.json
mcphubs remove github

# 调用与运行
mcphubs list                                        # 列出所有 Server
mcphubs tools github                                # 查看某个 Server 的工具
mcphubs call github.search_repositories query=test  # 调用工具
```

> CLI 使用 **Admin Token**（设置 → 安全 → Admin Token），而非 MCP API Key。详见 [CLI 文档](./cli/SKILL.md)。

## 🚀 快速开始

### Docker Compose（推荐）

```bash
git clone https://github.com/7-e1even/MCPHubs.git && cd MCPHubs
cp .env.example .env        # 根据需要修改配置
docker compose up -d
```

打开 `http://localhost:3000` — 使用 `admin` / `admin123` 登录。

### 本地开发

<details>
<summary><b>后端</b></summary>

```bash
pip install -r requirements.txt
cp .env.example .env
python main.py serve
```

</details>

<details>
<summary><b>前端（开发环境）</b></summary>

```bash
cd web
npm install
npm run dev
```

</details>

<details>
<summary><b>前端（生产部署）</b></summary>

```bash
cd web && npm install && npm run build && npm run start
```

</details>

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
| `MCPHUBS_EXPOSURE_MODE` | `progressive` | `progressive`（3 个元工具，渐进式）或 `full`（全量透传） |
| `MCPHUBS_DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL 连接字符串 |
| `MCPHUBS_API_KEY` | *（空）* | `/mcp` 端点的 Bearer Token（留空则不开启认证） |
| `MCPHUBS_HOST` | `0.0.0.0` | 监听地址 |
| `MCPHUBS_PORT` | `8000` | 监听端口 |
| `MCPHUBS_JWT_SECRET` | *（随机生成）* | 后台登录的 JWT 签名密钥 |
| `MCPHUBS_ADMIN_USERNAME` | `admin` | 管理员账号 |
| `MCPHUBS_ADMIN_PASSWORD` | `admin123` | 管理员密码 |

## 📡 管理 API

<details>
<summary><b>查看 API 示例</b></summary>

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

</details>

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

## 📄 开源协议

[MIT](LICENSE)
