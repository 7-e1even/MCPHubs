#!/usr/bin/env node

/**
 * MCPHubs CLI — call MCP tools from your terminal.
 *
 * Usage:
 *   mcphubs config                              — 交互式配置 URL 和 Token
 *   mcphubs list [--query <keyword>]            — 列出 Server
 *   mcphubs tools <server>                      — 列出工具
 *   mcphubs call <server>.<tool> [key=value ...] — 调用工具
 *
 * Config priority: env vars > ~/.mcphubsrc > defaults
 */

import { Command } from "commander";
import { MCPHubsClient } from "./client.js";
import { loadConfig, saveConfig, getConfigPath } from "./config.js";

const program = new Command();

// Save original argv before Commander strips "--"
const rawArgv = [...process.argv];

function getClient(): MCPHubsClient {
  const cfg = loadConfig();
  if (!cfg.token) {
    console.error(
      "✗ Token not configured. Run `mcphubs config` to set up."
    );
    process.exit(1);
  }
  return new MCPHubsClient(cfg.url, cfg.token);
}

program
  .name("mcphubs")
  .description("CLI for MCPHubs — call MCP tools from your terminal")
  .version("0.1.0")
  .enablePositionalOptions();

program.addHelpText("after", `
Examples:

  # Setup
  mcphubs config --url http://localhost:8000 --token "your_admin_token"

  # Install a MCP Server (stdio)
  mcphubs install github -e GITHUB_TOKEN=xxx -- npx -y @modelcontextprotocol/server-github

  # Install a remote MCP Server
  mcphubs install --transport sse remote https://example.com/mcp

  # Import from JSON config file
  mcphubs install --from claude_desktop_config.json

  # List servers / tools / call
  mcphubs list
  mcphubs tools github
  mcphubs call github.search_repositories query=mcphubs per_page=3

  # Remove a server
  mcphubs remove github
`);

// ─── config ────────────────────────────────────────

program
  .command("config")
  .description("Configure MCPHubs URL and Token (saved to ~/.mcphubsrc)")
  .option("--url <url>", "MCPHubs Gateway URL")
  .option("--token <token>", "Admin Token")
  .action(async (opts) => {
    if (!opts.url && !opts.token) {
      const current = loadConfig();
      console.log(`Config: ${getConfigPath()}`);
      console.log(`  URL:   ${current.url}`);
      console.log(`  Token: ${current.token ? "****" + current.token.slice(-4) : "(not set)"}`);
      console.log(`\nUsage: mcphubs config --url <url> --token <token>`);
      return;
    }
    const current = loadConfig();
    saveConfig({
      url: opts.url || current.url,
      token: opts.token || current.token,
    });
    console.log(`✓ Config saved to ${getConfigPath()}`);
  });

// ─── list ──────────────────────────────────────────

program
  .command("list")
  .description("List all registered MCP Servers")
  .option("-q, --query <keyword>", "Filter by name/description")
  .action(async (opts) => {
    const client = getClient();
    const servers = await client.listServers();
    let items = servers;
    if (opts.query) {
      const q = opts.query.toLowerCase();
      items = items.filter(
        (s: any) =>
          s.name?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q)
      );
    }

    if (items.length === 0) {
      console.log("No servers found.");
      return;
    }

    // Table output
    const nameW = Math.max(6, ...items.map((s: any) => s.name?.length || 0));
    const transW = Math.max(9, ...items.map((s: any) => s.transport?.length || 0));

    console.log(
      `  ${"NAME".padEnd(nameW)}  ${"TRANSPORT".padEnd(transW)}  ${"STATUS".padEnd(10)}  DESCRIPTION`
    );
    for (const s of items) {
      const status = s.status || "unknown";
      const statusColor =
        status === "connected" ? `\x1b[32m${status}\x1b[0m` : `\x1b[31m${status}\x1b[0m`;
      console.log(
        `  ${(s.name || "").padEnd(nameW)}  ${(s.transport || "").padEnd(transW)}  ${statusColor.padEnd(10 + 9)}  ${s.description || ""}`
      );
    }
    console.log(`\n  ${items.length} server(s)`);
  });

// ─── tools ─────────────────────────────────────────

program
  .command("tools <server>")
  .description("List tools for a server")
  .action(async (server: string) => {
    const client = getClient();
    const data = await client.listTools(server);
    const tools = data.tools || [];

    if (tools.length === 0) {
      console.log(`  ${server} — no tools`);
      return;
    }

    console.log(`  ${server} — ${tools.length} tool(s)\n`);

    for (const t of tools) {
      const schema = t.inputSchema || {};
      const props = schema.properties || {};
      const required = new Set(schema.required || []);

      // Build param list
      const params = Object.entries(props)
        .map(([k, v]: [string, any]) => {
          const req = required.has(k) ? "*" : "?";
          return `${k}${req}`;
        })
        .join(", ");

      const disabled = t.disabled ? " \x1b[31m[DISABLED]\x1b[0m" : "";
      console.log(`  ${t.name}(${params})${disabled}`);
      if (t.description) {
        console.log(`    ${t.description}`);
      }
      console.log();
    }
  });

// ─── call ──────────────────────────────────────────

program
  .command("call <target>")
  .description("Call a tool: <server>.<tool> [key=value ...] or --json '{}'")
  .option("-j, --json <json>", "Arguments as JSON string")
  .allowUnknownOption(false)
  .argument("[args...]", "Arguments as key=value pairs")
  .action(async (target: string, args: string[], opts) => {
    const dot = target.indexOf(".");
    if (dot === -1) {
      console.error(
        `✗ Invalid target "${target}". Use <server>.<tool> format.`
      );
      process.exit(1);
    }

    const server = target.slice(0, dot);
    const tool = target.slice(dot + 1);

    // Parse arguments
    let toolArgs: Record<string, any> = {};
    if (opts.json) {
      try {
        toolArgs = JSON.parse(opts.json);
      } catch {
        console.error("✗ Invalid JSON in --json");
        process.exit(1);
      }
    }
    // key=value pairs override/merge
    for (const arg of args) {
      const eq = arg.indexOf("=");
      if (eq === -1) {
        console.error(`✗ Invalid argument "${arg}". Use key=value format.`);
        process.exit(1);
      }
      const key = arg.slice(0, eq);
      let value: any = arg.slice(eq + 1);
      // Auto-coerce
      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (value === "null") value = null;
      else if (/^\d+$/.test(value)) value = parseInt(value, 10);
      else if (/^\d+\.\d+$/.test(value)) value = parseFloat(value);
      else {
        // Try JSON parse for objects/arrays
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed === "object") value = parsed;
        } catch {
          // keep as string
        }
      }
      toolArgs[key] = value;
    }

    const client = getClient();
    const start = Date.now();
    const result = await client.callTool(server, tool, toolArgs);
    const elapsed = Date.now() - start;

    if (result.status === "error") {
      console.error(`✗ ${result.error} (${result.elapsed_ms || elapsed}ms)`);
      process.exit(1);
    }

    // Print result content
    for (const item of result.result || []) {
      if (item.type === "text") {
        // Try to pretty-print JSON
        try {
          const parsed = JSON.parse(item.text);
          console.log(JSON.stringify(parsed, null, 2));
        } catch {
          console.log(item.text);
        }
      } else {
        console.log(`[${item.type}]`, item.data || "");
      }
    }

    console.error(`\n  ✓ ${server}.${tool} (${result.elapsed_ms || elapsed}ms)`);
  });

// ─── install ───────────────────────────────────────

program
  .command("install")
  .description(
    "Register a new MCP Server (like claude mcp add)"
  )
  .argument("[name]", "Server name")
  .argument("[url]", "Server URL (for sse/http transport)")
  .option(
    "-t, --transport <type>",
    "Transport: stdio / sse / streamable-http",
    "stdio"
  )
  .option(
    "-e, --env <KEY=VAL>",
    "Environment variable (repeatable)",
    (v: string, prev: string[]) => [...prev, v],
    [] as string[]
  )
  .option(
    "--header <Key: Val>",
    "HTTP header (repeatable)",
    (v: string, prev: string[]) => [...prev, v],
    [] as string[]
  )
  .option("-d, --desc <text>", "Server description")
  .option("--no-test", "Skip connectivity test after install")
  .option("--from <file>", "Import from JSON config file (Claude/VSCode/generic)")
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(async (name: string | undefined, url: string | undefined, opts: any, cmd: any) => {
    const client = getClient();

    // ── --from: import from JSON file ──
    if (opts.from) {
      const { readFileSync } = await import("fs");
      let data: any;
      try {
        data = JSON.parse(readFileSync(opts.from, "utf-8"));
      } catch (e: any) {
        console.error(`✗ Cannot read file: ${e.message}`);
        process.exit(1);
      }
      const result = await client.importServers(data);
      for (const s of result.imported || []) {
        console.log(`  ✓ ${s.name}`);
      }
      for (const s of result.skipped || []) {
        console.log(`  ⊘ ${s.name} (${s.reason})`);
      }
      for (const s of result.errors || []) {
        console.error(`  ✗ ${s.name}: ${s.error}`);
      }
      console.log(
        `\n  ${(result.imported || []).length} imported, ${(result.skipped || []).length} skipped, ${(result.errors || []).length} errors`
      );
      return;
    }

    // ── Normal install ──
    if (!name) {
      console.error("✗ Server name is required. Usage: mcphubs install <name> [url] [-- command args...]");
      process.exit(1);
    }

    const transport = opts.transport;
    const body: Record<string, any> = { name, transport };

    if (transport === "stdio") {
      // Extract the command to run as a stdio MCP server.
      // Strategy: try rawArgv first (Unix preserves "--"), then fallback
      // to Commander's excess args (Windows npm wrapper strips "--").
      let cmdParts: string[];
      const ddIdx = rawArgv.indexOf("--");
      if (ddIdx !== -1) {
        // Unix / direct node invocation: "--" is preserved
        cmdParts = rawArgv.slice(ddIdx + 1);
      } else {
        // Windows npm wrapper strips "--": use Commander's remaining args.
        // cmd.args contains all positional args passed to this subcommand.
        // The first one is `name` (already consumed), so the rest is the command.
        const remaining = cmd.args.slice(1); // skip name
        cmdParts = remaining;
      }
      if (cmdParts.length === 0) {
        console.error(
          "✗ stdio transport requires a command after the server name\n" +
          "  Example: mcphubs install my-server -- npx -y @example/mcp-server\n" +
          "  Windows: mcphubs install my-server npx -y @example/mcp-server"
        );
        process.exit(1);
      }
      body.command = cmdParts[0];
      body.args = cmdParts.slice(1);
    } else {
      // sse / streamable-http: url is required
      if (!url) {
        console.error(`✗ URL is required for ${transport} transport.\n  Example: mcphubs install --transport ${transport} my-server https://example.com/mcp`);
        process.exit(1);
      }
      body.url = url;
    }

    // --env KEY=VAL (repeatable)
    if (opts.env.length > 0) {
      const env: Record<string, string> = {};
      for (const pair of opts.env) {
        const eq = pair.indexOf("=");
        if (eq === -1) {
          console.error(`✗ Invalid --env "${pair}". Use KEY=VAL format.`);
          process.exit(1);
        }
        env[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
      body.env = env;
    }

    // --header "Key: Val" (repeatable)
    if (opts.header.length > 0) {
      const headers: Record<string, string> = {};
      for (const h of opts.header) {
        const sep = h.indexOf(":");
        if (sep === -1) {
          console.error(`✗ Invalid --header "${h}". Use "Key: Val" format.`);
          process.exit(1);
        }
        headers[h.slice(0, sep).trim()] = h.slice(sep + 1).trim();
      }
      body.headers = headers;
    }

    if (opts.desc) {
      body.description = opts.desc;
    }

    // Register
    const info = await client.registerServer(body);
    console.log(`✓ Registered ${info.name} (${info.transport})`);

    // Auto-test connectivity
    if (opts.test !== false) {
      process.stdout.write("  Testing connectivity...");
      const test = await client.testServer(name);
      if (test.connected) {
        console.log(` ✓ connected (${test.elapsed_ms}ms, ${test.tools_count} tools)`);
      } else {
        console.log(` ✗ failed: ${test.error}`);
      }
    }
  });

// ─── remove ────────────────────────────────────────

program
  .command("remove <name>")
  .description("Unregister a MCP Server")
  .action(async (name: string) => {
    const client = getClient();
    const result = await client.removeServer(name);
    console.log(`✓ ${result.message || `Removed ${name}`}`);
  });

program.parse();
