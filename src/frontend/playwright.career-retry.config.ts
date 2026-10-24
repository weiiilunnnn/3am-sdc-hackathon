import { defineConfig } from "@playwright/test";
const port = Number(process.env.CAREER_RETRY_TEST_PORT ?? 3119);
const url = `http://127.0.0.1:${port}`;

// Frontend-only: every API request is intercepted in this focused suite.
export default defineConfig({
  testDir: "./e2e", testMatch: "career-retry.spec.ts", workers: 1, timeout: 60_000,
  use: { baseURL: url, channel: process.env.PW_BROWSER_CHANNEL },
  webServer: {
    command: `npm run dev:frontend -- --hostname 127.0.0.1 --port ${port}`,
    url, reuseExistingServer: false, timeout: 60_000,
    env: { NEXT_DIST_DIR: ".next-e2e/retry", BACKEND_URL: "http://127.0.0.1:1" },
  },
});
