# FutureReady - Team 3AM

Sourced technology-role matching and personalised starter reskilling pathways for the SDC Hackathon Domain 1. Built with the team's existing Next.js/React/TypeScript frontend and FastAPI/Python backend.

Team: **3AM**, Asia Pacific University, leader **Ooi Wei Lun**. SDG track: **4 - Quality Education**. [Repository](https://github.com/weiiilunnnn/3am-sdc-hackathon).

## What works

- Future-Role Matching discovers candidates from a locally indexed complete official ESCO API collection: 3,658 occupations, 14,579 concepts and 126,051 essential/optional relationships, requested release v1.2.1.
- The React matching view uses the separate v2 API: IDF-weighted profile relevance, a configurable 30% threshold with evidence safeguards, variable result counts and server pagination/search. Legacy v1 strict essential coverage remains available unchanged.
- Compact sourced development areas, one-element Read more/Show less descriptions and a bottom method disclosure. Market Outlook placeholders were removed only from matching; team trend/SDG/scenario interfaces remain.
- Existing synthetic intake now searches the indexed concepts on the backend. Thirteen synthetic profiles were evaluated; no real CV or personal data is used.
- Personalised Reskilling remains unchanged: 22 reviewed resources, existing prerequisite/phase/time logic, explicit incomplete coverage. A minimal API adapter supports newly discovered role IDs.
- Offline local matching, explicit official API lookup/search with bounded cache/timeouts and a clearly labelled 15-role fallback. Without full frequency evidence, the fallback does not manufacture qualified scores.

Current Feature 3 implementation, source/version caveats, all measured examples, tests, file map and rebuild commands: [FUTURE_ROLE_IMPLEMENTATION.md](docs/FUTURE_ROLE_IMPLEMENTATION.md). Earlier enhancement reports are historical where they conflict with this approved matching change.

**Current scope:** Features 3 and 4 plus temporary synthetic intake. Indexed occupations and concept links are sourced; learning coverage is intentionally partial, as approved. Real updatable trend ingestion, complete sourced SDG mappings and defined future-scenario effects await teammates. The app does not yet satisfy all six final-product requirements. It uses no real CVs or personal profiles and makes no hiring/proficiency or Malaysian demand guarantee.

## Run locally (PowerShell)

Use Python 3.12 and Node.js 24 LTS (tested: Python 3.12.14, Node 24.16.0). Start from the repository root.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Terminal 1, repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir src --reload --host 127.0.0.1 --port 8000
```

Terminal 2:

```powershell
cd src/frontend
npm.cmd ci
npm.cmd run dev
```

Open **http://localhost:3000**. Backend API docs: **http://127.0.0.1:8000/docs**.

The existing Next.js rewrite forwards `/api/*` to `http://127.0.0.1:8000/api/*`. For another backend, set `BACKEND_URL=http://your-backend:8000` in `src/frontend/.env.local` and restart Next.js. Use the backend origin without `/api` or a trailing slash. No browser API secret is needed.

On macOS/Linux replace `.venv\Scripts\python.exe` with `.venv/bin/python`. If Python is not on PATH, use your installed interpreter's full path for venv creation. Virtual environment activation is optional when using its executable directly.

The ESCO index and learning catalogues are local reference files. Starting the app never downloads a dataset or calls a recommendation API. Google Fonts is optional; system fonts provide a fallback. `runpod/handler.py` remains the team's echo skeleton, and the existing RunPod dependency is retained; these features do not require a RunPod endpoint/API key. `.replit` now starts FastAPI; it does not configure a complete two-service cloud deployment. No production deployment is claimed.

## Tests and production build

Backend, from root:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe scripts/export_contract_schemas.py
```

Frontend, from `src/frontend`:

```powershell
npm.cmd run typecheck
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Playwright starts isolated FastAPI/Next.js servers on ports 8100/3100 with a separate `.next-e2e` build directory. It does not reuse or stop your development servers on 8000/3000. Use the `npm.cmd`/`npx.cmd` commands shown in PowerShell to avoid blocked `.ps1` shims. On another Python setup set `PYTHON_EXECUTABLE` to an absolute interpreter path before running it. Real browser tests cover multiple profiles/roles, citations, provider links, relevance safeguards, description toggling, input editing, recovery and mobile overflow. Successful runs write previews under `docs/screenshots/`. If sandboxed browser launch reports a missing executable despite an installed browser, run the tests with the required local filesystem/process access. For production locally, run `npm.cmd run start` after building, with FastAPI running separately.

## Code and data map

| Area | Location |
|---|---|
| HTTP endpoints and preserved health/summarize routes | `src/main.py` |
| Pure matching / pathway services | `src/future_role_matching.py`, `src/personalized_reskilling.py` |
| Contracts, profile normalisation, source loader, trend adapter | `src/models.py`, `skills_intake.py`, `data_repository.py`, `trend_adapter.py` |
| Existing Next app and reusable React components | `src/frontend/app/`, `components/`, `lib/` |
| Full discovery index and legacy 15-role fallback | `data/index/`, `data/occupations/` |
| Reviewed provider catalogue | `data/resources/` |
| Source registry and verification logs | `data/sources/` |
| Synthetic profiles and snapshot fixtures | `data/demo/` |
| Backend / browser tests | `tests/`, `src/frontend/e2e/` |

Enhancement audit, all before/after scores and decision: [SCORING_AUDIT.md](docs/SCORING_AUDIT.md). Exact role/resource inventory and evidence: [CATALOGUE_REVIEW.md](docs/CATALOGUE_REVIEW.md). Change summary: [ENHANCEMENT_REPORT.md](docs/ENHANCEMENT_REPORT.md).

See [API contracts and teammate interfaces](docs/CONTRACTS.md), [scoring and limitations](docs/SCORING_AND_LIMITATIONS.md), [sources and licences](docs/DATA_SOURCES_AND_LICENSES.md), [acceptance walkthrough](docs/DEMO_CHECKLIST.md), and [executed verification results](docs/VERIFICATION.md).

Reference updates are explicit authoring operations, not startup tasks:

```powershell
.\.venv\Scripts\python.exe scripts/prepare_esco_subset.py --verified-date YYYY-MM-DD
.\.venv\Scripts\python.exe scripts/check_source_links.py
```

Review rights/content, inspect diffs, update verification records and run tests before distributing changes. `scripts/curate_learning_catalog.py` reproduces the catalogue reviewed on 21 October 2026; it does not automatically reverify curricula. Restart FastAPI after approved data changes. HTTP clients cannot invent new verified evidence: review/register it in `data/sources/integration_sources.json` first.

## Attribution and licence

This service uses the ESCO classification of the European Commission. The English subset, scoring method and editorial course mappings are project additions and imply no endorsement. European classification data are not Malaysian labour-market evidence.

Project code: [Apache 2.0](LICENSE). Third-party data/content retain their own terms; see the source inventory. No course content is mirrored. No deployment, sponsor service usage or measured workforce impact is claimed merely from repository folders or fixtures.
