import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const python = process.env.PYTHON_EXECUTABLE ?? path.resolve(process.cwd(), "../..", process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
export default defineConfig({
  testDir: "./e2e", fullyParallel: false, workers: 1, timeout: 45_000,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: `"${python}" -m uvicorn main:app --app-dir .. --host 127.0.0.1 --port 8100`, url: "http://127.0.0.1:8100/api/health", reuseExistingServer: false, timeout: 60_000 },
    { command: "npm run dev -- --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100", env: { BACKEND_URL: "http://127.0.0.1:8100", NEXT_DIST_DIR: ".next-e2e" }, reuseExistingServer: false, timeout: 60_000 },
  ],
});
