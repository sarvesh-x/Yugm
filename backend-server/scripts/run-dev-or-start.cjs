const { spawn } = require("node:child_process");

const script = process.env.NODE_ENV === "production" ? "start:api" : "dev:api";
const isWindows = process.platform === "win32";

// Avoid passing args with shell:true on Windows (DEP0190). Script name is internal/constant.
const child = isWindows
  ? spawn(`npm run ${script}`, { stdio: "inherit", shell: true })
  : spawn("npm", ["run", script], { stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
