---
name: mcphubs-cli
description: Use when calling MCP tools from terminal, debugging MCP servers, listing registered servers, or scripting MCP tool invocations without an AI client. Triggers on "mcphubs", "call tool from terminal", "list servers", "CLI config".
---

# MCPHubs CLI

Call MCP tools directly from your terminal via the MCPHubs REST API. No AI client needed.

## Quick Reference

| Command                        | Purpose                                     | Example                                               |
| ------------------------------ | ------------------------------------------- | ----------------------------------------------------- |
| `mcphubs config`               | Set URL + Admin Token                       | `mcphubs config --url http://host:8000 --token "xxx"` |
| `mcphubs list`                 | List servers                                | `mcphubs list --query git`                            |
| `mcphubs tools <server>`       | List tools (`*` = required, `?` = optional) | `mcphubs tools github`                                |
| `mcphubs call <server>.<tool>` | Invoke a tool                               | `mcphubs call github.search_repositories query=test`  |

## Setup

```bash
npm i -g mcphubs                          # Install
mcphubs config --url <URL> --token <TOKEN> # Configure (~/.mcphubsrc)
```

Auth uses **Admin Token** (from Settings → Security), NOT the MCP API Key.
Env vars `MCPHUBS_URL` / `MCPHUBS_TOKEN` override config file.

## Passing Arguments

```bash
# key=value (auto type coercion: numbers, booleans, JSON objects)
mcphubs call github.search_repositories query=mcphubs per_page=5

# --json for complex args
mcphubs call server.tool --json '{"key": "value"}'
```

## Common Mistakes

| Mistake                                 | Fix                                                        |
| --------------------------------------- | ---------------------------------------------------------- |
| Using API Key instead of Admin Token    | CLI hits `/api/*` (REST), not `/mcp`. Use Admin Token.     |
| `--json` with single quotes on Windows  | Use `--json "{\"key\":\"val\"}"` or use `key=value` syntax |
| Pointing URL to port 3000 (frontend)    | Point to port **8000** (backend API)                       |
| Forgetting `<server>.<tool>` dot syntax | Always `server.tool`, not `server tool`                    |