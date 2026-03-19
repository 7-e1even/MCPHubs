/**
 * MCPHubs CLI Config
 *
 * Reads/writes config from ~/.mcphubsrc (JSON).
 * Priority: env vars > config file > defaults.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_PATH = join(homedir(), ".mcphubsrc");

export interface CLIConfig {
  url: string;
  token: string;
}

const DEFAULTS: CLIConfig = {
  url: "http://localhost:8000",
  token: "",
};

/** Strip surrounding quotes (Windows CMD `set X="val"` includes quotes) */
function strip(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

/** Load config: env vars > ~/.mcphubsrc > defaults */
export function loadConfig(): CLIConfig {
  let file: Partial<CLIConfig> = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      file = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    } catch {
      // ignore corrupt file
    }
  }

  return {
    url: strip(process.env.MCPHUBS_URL || file.url || DEFAULTS.url),
    token: strip(process.env.MCPHUBS_TOKEN || file.token || DEFAULTS.token),
  };
}

/** Save config to ~/.mcphubsrc */
export function saveConfig(cfg: Partial<CLIConfig>): void {
  let existing: Partial<CLIConfig> = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      existing = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    } catch {
      // overwrite corrupt file
    }
  }
  const merged = { ...existing, ...cfg };
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2) + "\n", "utf-8");
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
