// Run before `next start` on the school's server. Refuses to start a server that a stranger
// could set up first: with no accounts yet, MACS_SETUP_CODE must be set.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const env = { ...process.env };
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

if (env.MACS_NO_SIGNIN?.trim() === "1") {
  console.error("MACS_NO_SIGNIN=1 is for one computer only. Remove it before running the shared server.");
  process.exit(1);
}

const dataDir = env.MACS_DATA_DIR || path.join(process.cwd(), "data");
const hasAccounts = existsSync(path.join(dataDir, "accounts.json"));

if (!hasAccounts && !env.MACS_SETUP_CODE?.trim()) {
  console.error("No staff accounts yet. Set MACS_SETUP_CODE in .env.local (something long), then start again.");
  process.exit(1);
}
if (!env.OPENROUTER_API_KEY?.trim()) console.warn("OPENROUTER_API_KEY is not set: the workspace will answer in demo mode.");
console.log(`Shared data: ${dataDir}`);
