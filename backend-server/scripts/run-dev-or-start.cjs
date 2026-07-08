const { spawn } = require("node:child_process");

const command = process.platform === "win32" ? "npm.cmd" : "npm";
const script = process.env.NODE_ENV === "production" ? "start:api" : "dev:api";

const child = spawn(command, ["run", script], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
