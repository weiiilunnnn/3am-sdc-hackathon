# 3AM SDC Hackathon

A career-development prototype combining Pathwaay’s onboarding and career/SDG scenario demo with Aiversecity’s saved fictional profiles, CV tools, research evidence and employment snapshots.

## Local development

Requires Python 3.10+ and Node.js 22.18+ (Node 24 recommended). Use npm inside `src/frontend`; this repository is not a pnpm workspace.

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
npm --prefix src/frontend ci
python scripts/dev.py
```

Open http://localhost:3000. The launcher starts FastAPI on 127.0.0.1:8080 and Next.js on port 3000, and stops both when interrupted or either service exits. `PORT` and `API_PORT` can override these development ports. The launcher requires a POSIX environment (macOS/Linux/Replit).

Alternatively, run each service in its own terminal:

```sh
python -m uvicorn src.main:app --host 127.0.0.1 --port 8080 --reload
npm --prefix src/frontend run dev
```

Next.js proxies `/api/*` to `BACKEND_URL` (default `http://127.0.0.1:8080`). FastAPI docs are at http://127.0.0.1:8080/docs. SQLite defaults to `src/data/future_ready.sqlite3`; set `APP_DB_PATH` to change it. Keep local data and credentials out of Git.

## Pages and integration

| URL | Behavior |
| --- | --- |
| `/` | Redirects to `/register`, matching main |
| `/register`, `/login` | Main’s onboarding/sign-in previews; no account creation or authentication |
| `/explorer` | Main’s illustrative career, SDG and scenario demo |
| `/profile` | SH’s existing profile editor, sample profiles and CV upload/review (previously `/`) |
| `/home` | Saved-profile workspace overview |
| `/cv-studio` | Saved-profile CV previews and printing |
| `/outlook` | Profile-content checks and cached skill evidence |
| `/explore` | Skills catalogue with profile, research and posting filters |
| `/radar` | OpenAlex research and Remote OK job-source evidence |

The career demo links to the workspace, and the workspace links back. Onboarding answers remain in memory and are not silently copied into saved profiles. Use fictional details only. No page implements account security or personalised career predictions.

## Structure

```text
src/
  main.py                  FastAPI entry point
  api/                     API routes
  models/                  Validation and response contracts
  services/                Business logic, SQLite storage and source adapters
  data/                    Local vocabulary and fictional samples
  frontend/
    package.json           Frontend dependencies and commands
    package-lock.json      npm lockfile
    app/
      (pathwaay)/           Main’s pages and root layout
      (workspace)/          SH’s pages and root layout
    lib/                   Frontend API client and helpers
runpod/handler.py          Main’s unused serverless placeholder
scripts/dev.py            Optional two-service development launcher
tests/                    Python, frontend logic and component tests
docs/                     Architecture, data sources and verification
submission/               Competition documents
```

Route-group names in parentheses do not appear in URLs. Separate root layouts prevent the two existing global stylesheets from affecting each other. Crossing between groups performs a full page load; saved fictional profiles remain available through the existing browser profile ID and SQLite storage.

## Verification

```sh
python -m unittest discover tests
npm --prefix src/frontend run test:logic
npm --prefix src/frontend run test:components
npm --prefix src/frontend run typecheck
npm --prefix src/frontend run build
```

Tests use synthetic fixtures and temporary databases. Live external-source availability and production hosting are separate checks. See [testing](docs/testing.md) and [branch integration](docs/branch-integration.md).

## Replit and production

After installing Python and frontend dependencies, the Replit Run button uses `scripts/dev.py`. Only the frontend needs a public port; it proxies API calls to the local backend. The previous artifact/workspace configuration and unrelated database post-merge hook have been removed.

For a production server, build with `npm --prefix src/frontend run build`, run FastAPI without `--reload`, and run `npm --prefix src/frontend run start`. Configure `BACKEND_URL` when building if the API is not at the default address. Replit deployment and durable SQLite storage must be configured and verified separately; the development launcher is not a production deployment configuration.

RunPod is not used by the app. `runpod/handler.py` is restored from main for team compatibility and still contains placeholder echo logic; it needs a separate RunPod runtime before it can be deployed.

## Team and submission

Team **3AM**, Domain 1, SDG 4 — Quality Education. Team leader: Ooi Wei Lun. University: Asia Pacific University. Team size: 3.

The team still needs to supply final live-demo, slide-deck and video links and complete its submission documentation and proofs of use. Existing documents are retained under `submission/`.

Licensed under [Apache License 2.0](LICENSE).
