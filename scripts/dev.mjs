// Select the repository virtual environment without requiring shell activation.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localPython = resolve(root, process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
const python = process.env.PYTHON_EXECUTABLE || (existsSync(localPython) ? localPython : "python");
const child = spawn(python, [resolve(root, "scripts/dev.py"), ...process.argv.slice(2)], {
  cwd: root, stdio: ["pipe", "inherit", "inherit"],
  env: { ...process.env, NODE_EXECUTABLE: process.execPath, DEV_LAUNCHER_PIPE: "1" },
});
// A pipe works on Windows too, where child.kill() can bypass Python cleanup.
const stop = () => { if (!child.stdin.destroyed) child.stdin.end("stop\n"); };
child.stdin.on("error", () => {});
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
if (process.platform === "win32") process.on("SIGBREAK", stop);
child.on("error", (error) => {
  console.error(`Cannot start Python: ${error.message}. Install dependencies in .venv or set PYTHON_EXECUTABLE.`);
  process.exitCode = 1;
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
