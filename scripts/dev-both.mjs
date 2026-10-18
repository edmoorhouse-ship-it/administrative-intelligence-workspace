// Runs both profiles side by side on this computer: MACS on port 3000, construction on 3001.
// Each gets its own build folder, so the two dev servers don't collide; .env.local still applies
// (no-passcode mode, API keys), but the profile set here wins over WORKSPACE_PROFILE in that file.
// Ctrl+C stops both.
//
// If either port is already taken (usually an old workspace server still running), it says so and
// stops, rather than leaving the old server answering on that port. `npm run dev:both -- --restart`
// stops whatever is listening on 3000 and 3001 first.

import { execFileSync, spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const next = path.join(process.cwd(), "node_modules", ".bin", "next");
const SERVERS = [
  { tag: "macs   ", profile: "macs", port: 3000, distDir: ".next" },
  { tag: "precon ", profile: "construction", port: 3001, distDir: ".next-construction" },
];

const portFree = (port) =>
  new Promise((resolve) => {
    const probe = net.createServer().once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true))).listen(port, "127.0.0.1");
  });

/** Process ids listening on a port (macOS and Linux, via lsof). */
const listeners = (port) => {
  try {
    return execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return [];
  }
};

if (process.argv.includes("--restart")) {
  for (const { port } of SERVERS)
    for (const pid of listeners(port)) {
      console.log(`Stopping the old server on port ${port} (process ${pid}).`);
      try {
        process.kill(Number(pid));
      } catch {
        // already gone
      }
    }
  await new Promise((r) => setTimeout(r, 1500));
}

const busy = [];
for (const { port } of SERVERS) if (!(await portFree(port))) busy.push(port);
if (busy.length) {
  console.error(`\nPort ${busy.join(" and ")} ${busy.length > 1 ? "are" : "is"} already in use, most likely by an old workspace server still running.`);
  console.error("That old server is what you'd see in the browser, so nothing was started.\n");
  console.error("Fix: run this instead. It stops the old server(s) first:\n\n    npm run dev:both -- --restart\n");
  process.exit(1);
}

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
