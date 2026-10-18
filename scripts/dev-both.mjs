// Runs both profiles side by side on this computer: MACS on port 3000, construction on 3001.
// Each gets its own build folder, so the two dev servers don't collide; .env.local still applies
// (no-passcode mode, API keys), but the profile set here wins over WORKSPACE_PROFILE in that file.
// Ctrl+C stops both.

import { spawn } from "node:child_process";
import path from "node:path";

const next = path.join(process.cwd(), "node_modules", ".bin", "next");
const SERVERS = [
  { tag: "macs   ", profile: "macs", port: 3000, distDir: ".next" },
  { tag: "precon ", profile: "construction", port: 3001, distDir: ".next-construction" },
];

const children = SERVERS.map(({ tag, profile, port, distDir }) => {
  const child = spawn(next, ["dev", "-H", "127.0.0.1", "-p", String(port)], {
    env: { ...process.env, WORKSPACE_PROFILE: profile, NEXT_DIST_DIR: distDir },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = (stream, out) => {
    let rest = "";
    stream.on("data", (chunk) => {
      const lines = (rest + chunk).split("\n");
      rest = lines.pop() ?? "";
      for (const line of lines) out.write(`[${tag}] ${line}\n`);
    });
  };
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  child.on("exit", (code) => {
    console.log(`[${tag}] stopped${code ? ` (exit ${code})` : ""}. Stopping the other one too.`);
    stopAll();
  });
  return child;
});

console.log("MACS:          http://127.0.0.1:3000");
console.log("Construction:  http://127.0.0.1:3001");
console.log("Ctrl+C stops both.\n");

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill("SIGINT");
  setTimeout(() => process.exit(0), 1500);
}
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
