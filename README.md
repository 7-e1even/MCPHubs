# MCPHubs

> 注册任意 MCP Server (stdio / SSE / Streamable HTTP)，统一暴露为单一的 Streamable HTTP 端点。

<p align="center">
  <strong>带 Web 看板的统一 MCP 网关</strong>
</p>

<img src="./assets/dashboard.png" alt="MCPHubs Dashboard" width="800">

## 🌟 ModelScope MCP 集成

一键对接 [ModelScope MCP 广场](https://modelscope.cn/home)，轻松将云端 MCP Server 同步到本地网关。

<img src="./assets/ModelScope.png" alt="ModelScope Integration" width="800">

## ✨ 特性

- **统一网关** — 将多个 MCP Server 聚合为一个统一的端点
- **多协议支持** — stdio、SSE、Streamable HTTP
- **渐进式模式 (Progressive)** — 默认仅暴露 3 个元工具 (`list_servers`, `list_tools`, `call_tool`)，大幅减少大模型前置 Token 消耗
- **完整模式 (Full)** — 直接暴露所有 Server 的所有具体工具
- **Web 看板** — 现代化的 UI 界面，用于管理、导入和导出 Server
- **JSON 批量导入** — 自动识别 Claude Desktop / VS Code / 通用 JSON 格式
- **ModelScope 同步** — 从魔搭社区 MCP 广场一键导入可用工具
- **LLM 自动摘要** — 接入任意兼容 OpenAI 的接口，自动为 Server 生成功能描述
- **API Key 认证** — 支持通过 Bearer Token 保护 `/mcp` 接口

## 🏗 架构

```
AI 客户端 → Streamable HTTP → MCPHubs 网关 → [stdio / SSE / HTTP MCP Servers]
                                   ↕
                              PostgreSQL
                                   ↕
                            Web 管理控制台 (Next.js)
```

## 🚀 快速开始

### Docker Compose（推荐）

```bash
git clone https://github.com/user/mcphubs.git
cd mcphubs
cp .env.example .env        # 根据需要修改配置
docker compose up -d
```

打开 `http://localhost:3000` — 使用 `admin` / `admin123` 登录。

### 本地开发

**后端：**

```bash
pip install -r requirements.txt
cp .env.example .env        # 修改数据库连接等配置
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
cd web
npm install
npm run build
npm run start
```

## 🔌 接入 AI 客户端

```json
{
  "mcpServers": {
    "mcphubs": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

如果配置了 API Key 认证：

```json
{
  "mcpServers": {
    "mcphubs": {
      "url": "http://localhost:8000/mcp",
      "headers": {
        "Authorization": "Bearer 你的_API_KEY"
      }
    }
  }
}
```

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

## ⚙️ 环境变量

| 变量名 | 默认值 | 说明 |
| ------------------------ | -------------------------- | ----------------------------------------- |
| `MCPHUBS_HOST`           | `0.0.0.0`                  | 监听地址                               |
| `MCPHUBS_PORT`           | `8000`                     | 监听端口                               |
| `MCPHUBS_DATABASE_URL`   | `postgresql+asyncpg://...` | PostgreSQL 数据库连接                     |
| `MCPHUBS_API_KEY`        | *(留空)*                  | `/mcp` 端点的 Bearer Token (留空则不开启校验) |
| `MCPHUBS_EXPOSURE_MODE`  | `progressive`              | `progressive` (渐进式) 或 `full` (全量)模式 |
| `MCPHUBS_JWT_SECRET`     | *(生成随机字符串)*             | 后台登录的 JWT 签名密钥                        |
| `MCPHUBS_ADMIN_USERNAME` | `admin`                    | 默认管理员账号                    |
| `MCPHUBS_ADMIN_PASSWORD` | `admin123`                 | 默认管理员密码                    |

## 📄 开源协议

[MIT](LICENSE)

