import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { mkdtempSync } from "node:fs";
const testStorage = mkdtempSync(path.join(os.tmpdir(), "3am-merge-e2e-"));

const python = process.env.PYTHON_EXECUTABLE ?? path.resolve(process.cwd(), "../..", process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
export default defineConfig({
  testDir: "./e2e", fullyParallel: false, workers: 1, timeout: 45_000,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: `"${python}" -m uvicorn src.main:app --app-dir ../.. --host 127.0.0.1 --port 8100`, url: "http://127.0.0.1:8100/api/health", env: { APP_DB_PATH: path.join(testStorage, "app.sqlite3"), PATHWAAY_MODEL_DIR: path.join(testStorage, "models"), TAVILY_API_KEY: "", RUNPOD_API_KEY: "", RUNPOD_ENDPOINT_ID: "", RUNPOD_LLM_ENDPOINT_ID: "" }, reuseExistingServer: false, timeout: 60_000 },
    { command: "npm run dev:frontend -- --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100", env: { BACKEND_URL: "http://127.0.0.1:8100", NEXT_DIST_DIR: ".next-e2e" }, reuseExistingServer: false, timeout: 60_000 },
  ],
});
