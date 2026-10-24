import { defineConfig } from "@playwright/test";
import path from "node:path";
import os from "node:os";
import { mkdtempSync } from "node:fs";
const folder=mkdtempSync(path.join(os.tmpdir(),"pathwaay-simulator-"));
const python=path.resolve("../..",process.platform==="win32"?".venv/Scripts/python.exe":".venv/bin/python");
const production=process.env.SIMULATOR_PRODUCTION_TEST==="1";
export default defineConfig({testDir:"./e2e",testMatch:"career-simulator.spec.ts",workers:1,timeout:90_000,expect:{timeout:25_000},
  use:{baseURL:"http://127.0.0.1:3127",channel:process.env.PW_BROWSER_CHANNEL,screenshot:"only-on-failure"},
  webServer:[
    {command:`"${python}" -m uvicorn src.main:app --app-dir ../.. --host 127.0.0.1 --port 8127`,url:"http://127.0.0.1:8127/api/health",
      env:{APP_DB_PATH:path.join(folder,"app.sqlite3"),RUNPOD_API_KEY:"",TAVILY_API_KEY:"",RUNPOD_ENDPOINT_ID:"",RUNPOD_LLM_ENDPOINT_ID:""},reuseExistingServer:false,timeout:60_000},
    {command:production?"npm run start -- --hostname 127.0.0.1 --port 3127":"npm run dev:frontend -- --hostname 127.0.0.1 --port 3127",url:"http://127.0.0.1:3127",
      env:{NEXT_DIST_DIR:production?".next-merge-check":".next-e2e/simulator",BACKEND_URL:"http://127.0.0.1:8127"},reuseExistingServer:false,timeout:60_000},
  ]});
