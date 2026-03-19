---
name: mcphubs-cli
description: Use when calling MCP tools from terminal, installing/removing MCP servers, debugging MCP servers, listing registered servers, or scripting MCP tool invocations without an AI client. Triggers on "mcphubs", "call tool from terminal", "list servers", "install server", "remove server", "CLI config".
---

# MCPHubs CLI

Call MCP tools directly from your terminal via the MCPHubs REST API. No AI client needed.

## Quick Reference

| Command                        | Purpose                                     | Example                                                        |
| ------------------------------ | ------------------------------------------- | -------------------------------------------------------------- |
| `mcphubs config`               | Set URL + Admin Token                       | `mcphubs config --url http://host:8000 --token "xxx"`          |
| `mcphubs install`              | Register a new MCP server                   | `mcphubs install github -- npx -y @modelcontextprotocol/server-github` |
| `mcphubs remove <name>`        | Unregister a server                         | `mcphubs remove github`                                        |
| `mcphubs list`                 | List servers                                | `mcphubs list --query git`                                     |
| `mcphubs tools <server>`       | List tools (`*` = required, `?` = optional) | `mcphubs tools github`                                         |
| `mcphubs call <server>.<tool>` | Invoke a tool                               | `mcphubs call github.search_repositories query=test`           |

## Server Management (install / remove)

```bash
# stdio server (command after --)
mcphubs install my-server -e API_KEY=xxx -- npx -y @example/mcp-server

# remote server (sse / streamable-http)
mcphubs install --transport sse my-server https://example.com/mcp

# import from Claude/VSCode JSON config
mcphubs install --from claude_desktop_config.json

# remove
mcphubs remove my-server
```

**install options:** `-t/--transport` (stdio|sse|streamable-http), `-e/--env KEY=VAL` (repeatable), `--header "Key: Val"` (repeatable), `-d/--desc`, `--no-test` (skip connectivity check), `--from <file>` (batch import).

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