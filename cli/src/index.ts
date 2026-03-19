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
  .version("0.1.0");

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

program.parse();
