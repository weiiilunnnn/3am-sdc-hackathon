# Pathwaay | Team 3AM — SDC Hackathon 2026

**Domain 1: Future-Ready Workforce · SDG 4: Quality Education**  
**Team:** 3AM · **University:** Asia Pacific University (APU)  
**Stack:** Next.js / React / TypeScript frontend + FastAPI / Python backend + SQLite  
**Repository:** https://github.com/weiiilunnnn/3am-sdc-hackathon

Pathwaay is a **hackathon research and demonstration prototype** that helps people organise their skills, explore AI-related workplace changes, compare their skills with documented occupational requirements, discover learning resources, and plan possible career transitions. It combines **source-backed ESCO, research, and job-posting evidence** with **optional RunPod language-model explanations**. Some separate legacy career/SDG examples are trained or ranked on **synthetic data**; these are illustrative, not real-world employment predictions.

> **Read this before trying the demo:** Pathwaay currently has **no production account authentication**. Registration, login, profiles, employer examples, and CV uploads are intended for **fictional/test data only**. Do not upload a real CV or sensitive personal information. Optional AI actions can transmit selected demonstration text to RunPod.

> **SDC Hackathon submission templates:** See the [organiser-provided Google Drive folder](https://drive.google.com/drive/folders/1xw7c2aN8N-at8hPEULzkcU76e_FFb0Ef) linked in the official README example. Confirm any required filenames, links, and submission deadlines against the organiser's latest instructions.

## Contents

- [Team information](#team-information)
- [Submission links](#submission-links)
- [Overview and problem statement](#overview-and-problem-statement)
- [Features and page guide](#features-and-page-guide)
- [Tech stack](#tech-stack)
- [How the system works](#how-the-system-works)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Install and run locally](#install-and-run-locally)
- [Run on Replit](#run-on-replit)
- [Configure RunPod safely](#configure-runpod-safely)
- [How we use Replit — required](#how-we-use-replit-required)
- [How we use RunPod — required](#how-we-use-runpod-required)
- [Optional Tavily course discovery](#optional-tavily-course-discovery)
- [Try the included CV examples](#try-the-included-cv-examples)
- [What works without API keys?](#what-works-without-api-keys)
- [Tests and verification](#tests-and-verification)
- [Troubleshooting](#troubleshooting)
- [Privacy, evidence, and limitations](#privacy-evidence-and-limitations)
- [Challenges and learnings](#challenges-and-learnings)
- [Future improvements](#future-improvements)
- [Team roster](#team-roster)
- [Submission checklist](#submission-checklist)
- [Sources, licences, and contributors](#sources-licences-and-contributors)
- [License](#license)

## Team information

| Field | Detail |
| --- | --- |
| Project / Solution Name | Pathwaay |
| Team Name | 3AM |
| Team Domain | Domain 1 — Future-Ready Workforce |
| Selected SDG | SDG 4 — Quality Education |
| Team Leader | Ooi Wei Lun |
| University | Asia Pacific University (APU), Malaysia |
| Number of Members | 3 |

## Submission links

| Resource | Link / status |
| --- | --- |
| Public GitHub repository | https://github.com/weiiilunnnn/3am-sdc-hackathon |
| Live demo | https://3-am-sdc-hackathon.replit.app/ |
| Replit project | |
| RunPod endpoint | Configured privately by the backend via `RUNPOD_LLM_ENDPOINT_ID`;  |
| Slide deck |  |
| Demo video |  |

> Endpoints and API keys are not the same: a RunPod endpoint address is not itself a secret credential, but whether its URL should be public depends on team/provider access policy. Do not embed a key in any link. The links above are not claimed to be live until verified by the team.

## Overview and problem statement

### Problem

Students, graduates, and career switchers may struggle to connect their current skills with changing AI-related work and practical learning options. Career suggestions without transparent occupational evidence or a realistic way to plan learning can be difficult to act on.

### Solution

Pathwaay brings together profile-building, real ESCO occupation/skill evidence, attributed AI research and job-posting observations, and reviewed learning links. Users can examine calculated career relevance, inspect documented skill gaps, and save a career-development timeline; optional RunPod GLM explanations help interpret supplied evidence. The separate legacy career/SDG demos use synthetic data and are **not** labour-market predictions.

### Key features

Registration and CV-assisted profile drafting; AI Trend Signal; ESCO Role Matching; Career Details; Personalised Reskilling Pathway; Career Simulator (Career Landscape + Life Chapter Designer); CV Studio; illustrative SDG Mapping; and fictional Employer View. See the page-by-page table below for exact data and AI boundaries.

## Features and page guide

| Page | URL | What it does | Underlying evidence / AI |
| --- | --- | --- | --- |
| Register / Login (demo) | `/register`, `/login` | Create a fictional career profile manually or by CV Fast Track | ESCO v1.2.1 skill search; optional RunPod GLM-5.3 for CV parsing and profile-skill suggestions; **not secure login** |
| My Home | `/home` | View current saved profile and overview | Saved profile / SQLite; no LLM needed for ordinary display |
| My Profile | `/profile`, `/profile/edit` | Review or edit skills, evidence, experience, education, and learning preferences | User-provided fictional information; canonical ESCO skill IDs where reviewed |
| CV Studio | `/cv-studio` | Arrange and print CV templates from saved data | Mostly local deterministic formatting, not fabricated AI achievements |
| AI Trend Signal | `/signals` | Explore AI-skill connections, research activity, job-posting evidence, and disruption outlook | Cached OpenAlex research observations, attributed Remote OK/Himalayas postings and other explicitly sourced research where available; optional validated RunPod text |
| Role Matching | `/role-matching` | Search occupations and view profile relevance | Full pinned ESCO v1.2.1 occupation/skill index; **deterministic** IDF-weighted matching, not an LLM or hiring probability |
| Career Details | `/role-matching/roles/[roleId]` | Skill Gap Impact Analysis, Transferable Skills Mapping, Skill Evidence Matrix | ESCO evidence with optional evidence-validated RunPod GLM interpretations |
| Personalised Reskilling Pathway | `/role-matching/roles/[roleId]/pathway` | Find relevant reviewed learning, prerequisite and gap coverage information | Local reviewed catalogue; optional Tavily Search/Extract plus bounded GLM query planning/evaluation; incomplete coverage and unknown prices are labelled |
| SDG mapping | `/role-matching/sdg` | Illustrative connections between selected roles/skills and SDG targets | Curated **synthetic** skill-to-SDG mapping; optional RunPod explanations, not measured SDG impact |
| Career Simulator | `/career-simulator` | Career Landscape + Life Chapter Designer; select routes and save goals, skill intentions, and breaks | Real ESCO occupations and calculated overlap; SQLite saved journey; optional user-triggered RunPod goal/skill insights, **no employment forecasting** |
| Employer View | `/employer`, `/employer/directory`, `/employer/profile` | Manage example departments and analyse listed team skills | **Fictional** staff/company records; local skill coverage; optional RunPod-generated learning ideas |
| Extra workspace views | `/outlook`, `/explore`, `/radar` | View profile insights, skill catalogue, research and job-source snapshots | Local evidence and separately labelled OpenAlex / employment-source records |

The older `/explorer` URL redirects to `/role-matching`. The repository retains a separate legacy synthetic Random Forest career/scenario service; it **must not** be confused with ESCO Role Matching.

## Tech stack

| Layer | Technology | Role |
| --- | --- | --- |
| Frontend | Next.js 16.4.2, React 19.3.1, TypeScript | Interactive pages, profile editing, career pathway and timeline UI |
| Backend | Python, FastAPI, Pydantic, Uvicorn | API routing, validation, data processing, provider integrations |
| Database | SQLite | Demo profiles, timelines, evidence snapshots, job/cache metadata |
| Occupation data | ESCO v1.2.1 local verified index | Canonical occupations and skills, required/optional relationships |
| Data feeds | OpenAlex, Remote OK, Himalayas where enabled | Attributed research and bounded job-posting observations |
| AI | RunPod Serverless with a compatible GLM-5.3 endpoint (optional) | Profile/CV extraction and bounded explanation generation |
| Additional search | Tavily Search/Extract (optional) | Source discovery/verification for learning resources |
| Local ML demo | scikit-learn Random Forest on synthetic training CSVs | Illustrative legacy career/scenario inference only |
| Developer/cloud environment | Replit-compatible `.replit` and local npm/Python launcher | Development; public deployment requires separate verification |

## How the system works

```text
Browser (Next.js / React)
       |
       | HTTP /api/* (Next.js rewrite)
       v
FastAPI (Python / Pydantic)
       |-- SQLite: fictional profiles, simulator journeys, cached snapshots/jobs
       |-- ESCO v1.2.1 local index: verified occupations and essential/optional skills
       |-- Deterministic services: matching, gap analysis, course eligibility, timeline
       |-- OpenAlex / job-source adapters: attributed research and posting evidence
       |-- Optional RunPod endpoint: CV parsing / explanatory GLM text
       `-- Optional Tavily Search + Extract: official-provider learning pages
```

**ESCO is locally indexed**, so launching the application does **not** download the entire ESCO dataset or require an ESCO API key. The verified full snapshot comprises **3,658 occupations** and **14,579 skill/knowledge concepts**. Occupation-to-skill relationships come from ESCO; the app's overlap scores and possible career connections are its own **calculations**, not official career transitions or predictions. Refer to [`docs/FUTURE_ROLE_IMPLEMENTATION.md`](docs/FUTURE_ROLE_IMPLEMENTATION.md) and [`docs/DATA_SOURCES_AND_LICENSES.md`](docs/DATA_SOURCES_AND_LICENSES.md).

## Project structure

```text
3am-sdc-hackathon/
├── .env.example                 # Public configuration template; no credentials
├── .gitignore                   # Excludes .env, database, caches and model artifacts
├── .replit                      # Replit development runner
├── README.md
├── LICENSE                      # Apache-2.0 project code licence
├── requirements.txt
├── requirements-dev.txt
├── data/                        # Synthetic ML samples and sourced ESCO/catalogue data
│   └── index/                   # Pinned verified ESCO snapshot and manifest
├── docs/                        # Architecture, source licences, QA and reference notes
│   └── demo-cvs/               # Fictional VALID/INVALID CV test files
├── runpod/
│   └── handler.py               # Optional synthetic-career inference handler; not proof of deployment
├── scripts/
│   ├── dev.py                   # Starts FastAPI + Next.js together
│   └── dev.mjs                  # npm launcher selecting Python environment
├── src/
│   ├── main.py                  # FastAPI app and router registration
│   ├── api/                     # Profile, trend, career, CV, simulator and employer routes
│   ├── models/                  # API data schemas
│   ├── services/                # Business logic, providers, local model and persistence
│   └── frontend/
│       ├── app/                 # Next.js pages and routing
│       ├── components/          # UI components
│       ├── lib/                 # API clients and state helpers
│       └── package.json         # npm scripts/dependencies
├── submission/                  # Current competition proof/documentation PDFs
└── tests/                       # Python and frontend tests
```

**Note:** The `runpod/handler.py` file is an optional legacy career-model handler, not evidence that the hosted GLM-5.3 endpoint is deployed from that file. The modern RunPod LLM calls use the backend's shared RunPod API client.

## Prerequisites

- **Git**
- **Python 3.10+** (`python` / `py` / `python3`; virtual environment recommended)
- **Node.js 22.18+** (Node 24 recommended) and **npm**
- Internet access for first-time package installation and **optional** external AI/data refreshes
- No Docker, database server, GPU, RunPod key, or Tavily key is required for the **core local source-backed demo**

All commands below assume you are in the **repository root**, except where explicitly stated. Use the `main` branch to match this README.

## Install and run locally

### 1. Clone the project

```bash
git clone https://github.com/weiiilunnnn/3am-sdc-hackathon.git
cd 3am-sdc-hackathon
git switch main
```

### 2. Create a Python virtual environment and install backend dependencies

**Windows PowerShell:**

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

**macOS / Linux:**

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

> On Windows, if PowerShell prevents activation, you can call `.\.venv\Scripts\python.exe -m pip install -r requirements.txt` directly, without changing system execution policy.

### 3. Install frontend dependencies

**From the repository root:**

```bash
npm --prefix src/frontend ci
```

Use `npm ci` (not `pnpm install`); `src/frontend` has the authoritative `package-lock.json`.

### 4. Create your local environment file

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**

```bash
cp .env.example .env
```

The default `.env.example` has blank keys. That is fine for the first run. **Do not commit `.env`, paste secrets into issues, or use `NEXT_PUBLIC_` prefixes for credentials.** FastAPI loads the repository-root `.env` at startup; shell/system environment values take precedence.

### 5. Start both services using one command

**From the repository root:**

```bash
npm --prefix src/frontend run dev
```

Or:

```bash
cd src/frontend
npm run dev
```

The launcher supervises **FastAPI at `http://127.0.0.1:8080`** and **Next.js at `http://localhost:3000`**. Next.js forwards requests matching `/api/*` to FastAPI. You should not need a separate terminal or manually start `uvicorn` when using this command.

Visit **http://localhost:3000**. The root page redirects to `/register`. To check the backend, open **http://127.0.0.1:8080/api/healthz** (expect `{"status":"ok"}`); interactive API docs are at **http://127.0.0.1:8080/docs**. Press **Ctrl+C** in the launcher terminal to stop both servers.

### Alternative: run services separately

From the repository root, in terminal A (with the virtual environment active):

```bash
python -m uvicorn src.main:app --host 127.0.0.1 --port 8080 --reload
```

In terminal B:

```bash
npm --prefix src/frontend run dev:frontend
```

The default frontend rewrite targets `http://127.0.0.1:8080`; if you run FastAPI on another port, configure `BACKEND_URL` for the frontend process.

### Optional: use different ports

From `src/frontend`, for example:

```bash
npm run dev -- --port 3001
```

Set `API_PORT` before launching if port 8080 is taken. **API and frontend ports must be different.** The launcher will detect occupied ports rather than silently reusing them.

## Run on Replit

This repository includes a `.replit` development configuration using **Node.js 24** and **Python 3.12**. It starts `python scripts/dev.py`, **not** `python src/main.py` by itself. The launcher runs both FastAPI and Next.js and exposes the frontend on port 3000.

1. Open an existing team Replit project **[TEAM TO ADD REPLIT URL]**, or import `https://github.com/weiiilunnnn/3am-sdc-hackathon` into a new Replit project.
2. In the Replit shell, install dependencies: `python -m pip install -r requirements.txt` and `npm --prefix src/frontend ci`.
3. If AI features are required, add `RUNPOD_API_KEY` and a compatible authorised `RUNPOD_LLM_ENDPOINT_ID` as **Replit Secrets**. Add `TAVILY_API_KEY` only when optional course discovery is needed. Do not commit an `.env` containing credentials.
4. Select **Run**. Replit executes `python scripts/dev.py`. Open the web preview on the frontend's exposed port.
5. Confirm that the page loads and that `/api/healthz` returns an `ok` response through the app proxy.

**Deployment distinction:** Replit's development Run button does not by itself constitute an independently verified, persistent public deployment. A team-managed deployment URL and durable SQLite configuration must be separately tested before it is supplied to judges.

## Configure RunPod safely

> **Each person deploying their own copy should create and use their own RunPod API key. Never use, publish, or commit a teammate's or hackathon organiser's key.** Running the non-AI portions of Pathwaay does not require RunPod.

### Important: an API key alone does not enable the LLM

RunPod authentication and model hosting are **different things**. The repository has a team-default GLM endpoint ID in `src/services/sdg_text.py`. A newly created key **does not automatically grant permission to use somebody else's endpoint**, nor does it deploy GLM-5.3. To use optional generative features independently, you must also obtain access to a **compatible endpoint in your own RunPod account/team**, or explicitly approved access to an existing endpoint. This may require configuring and funding a serverless deployment. **Charges, quotas, region and model availability depend on RunPod and your account.**

### Steps for your own RunPod setup

1. Register/sign in at [RunPod](https://www.runpod.io/) and review current [RunPod documentation](https://docs.runpod.io/) and pricing.
2. In the RunPod console, find the **API Keys** area and **create a new key** for this local project with the minimum permissions needed for submitting/status-checking inference jobs. Copy it privately; do not upload screenshots of it.
3. Identify a permitted **Serverless endpoint** that actually serves **GLM-5.3 or a compatible model/handler** accepting this project's RunPod payload format (`input.model`, `input.messages`, JSON output, `choices[0].message.content`). A generic endpoint running some other handler is not a drop-in replacement. Deploy/configure one only if you understand the provider's resources and possible charges. Confirm its endpoint ID and accessible permissions using your own account.
4. Set the following in **repository-root `.env`** (the values shown are placeholders only):

   ```dotenv
   RUNPOD_API_KEY=YOUR_OWN_PRIVATE_RUNPOD_API_KEY
   RUNPOD_LLM_ENDPOINT_ID=YOUR_AUTHORISED_GLM_ENDPOINT_ID
   ```

5. **Restart** `npm run dev` after modifying `.env`. Try an explicit AI action (for example, CV Fast Track on the fictional sample, or Generate on an explanation panel). A configured key/endpoint is **not a guarantee** that every generation succeeds: unavailable workers, rate limits, invalid model output and network timeouts are surfaced by the app.

**What the variables mean:**

| Variable | Function | Required? |
| --- | --- | --- |
| `RUNPOD_API_KEY` | Secret credential used **only in the backend** for RunPod inference | Only for optional RunPod-backed features |
| `RUNPOD_LLM_ENDPOINT_ID` | Overrides the project's team-default GLM endpoint; must refer to a compatible endpoint that **your account can access** | Strongly recommended for independent setup |
| `RUNPOD_ENDPOINT_ID` | **Separate** optional RunPod endpoint for the legacy synthetic Random Forest career service | Leave **blank** for the built-in local scikit-learn model unless you have deployed the matching handler |

The `.env.example` contains the variable names but **no real credentials**. The development launcher removes the provider keys from the Next.js child environment; the FastAPI server makes the authenticated requests. **Do not insert these values in browser code.**

### Which features use RunPod?

- **CV Fast Track registration:** after an explicit fictional-data/processing confirmation, RunPod helps parse and classify a CV; quoted evidence and ESCO IDs are checked before users review/save a profile.
- **Optional profile skill extraction:** RunPod suggests canonical ESCO concepts grounded in text entered in the fictional profile; user review is required.
- **AI Trend Signal / Career Details / SDG:** optional explanations or evidence-reviewed interpretations (not the primary source of facts).
- **Reskilling discovery / certification support:** optional planning or evaluation; Tavily remains a separate provider for online search/extraction.
- **Career Simulator:** optional, explicitly requested goal/skill insights. Career Landscape, Life Chapter Designer and the saved timeline work without the LLM.
- **Legacy career demo:** local scikit-learn is the default; only uses a **separate** RunPod model endpoint if `RUNPOD_ENDPOINT_ID` is deliberately configured.

Some features **require** a working RunPod endpoint to perform their particular AI action. For example, the **RunPod-assisted CV Fast Track does not silently become an offline AI parser**. If RunPod is unavailable, users should use **manual registration**; the separate deterministic CV-text API remains a distinct feature.

## How we use Replit (Required)

- **Development environment:** `.replit` defines the Node/Python environment and starts the dual-service app using `scripts/dev.py`.
- **Web application:** Next.js handles the interface; FastAPI is a separate local backend. The frontend forwards `/api/*` requests to FastAPI.
- **Secrets:** RunPod/Tavily credentials belong in private Replit Secrets if the team enables those services—not in tracked source files.
- **Hosting:** An always-on/public Replit deployment is **not independently established by source code alone**. The team must add its verified deployment link above if applicable.

**Existing proof-of-use file:** [`submission/REPLIT PROOF OF USE.pdf`](submission/REPLIT%20PROOF%20OF%20USE.pdf). This repository artifact should be checked to confirm it matches the actual team usage before submission.

## How we use RunPod (Required)

- **Workload:** The FastAPI backend optionally sends structured prompts to a compatible RunPod Serverless GLM endpoint for CV/profile skill extraction, conditional Career Details and SDG explanations, selected AI Trend Signal explanations, learning-resource planning, employer learning ideas, and user-triggered Life Chapter insights.
- **Integration:** The backend uses the shared `src/services/sources/runpod_api.py` client, `RUNPOD_API_KEY` (secret) and `RUNPOD_LLM_ENDPOINT_ID` (authorised GLM endpoint). Requests are sent server-side; secrets are not returned to browser code.
- **Model and evidence:** The application requests `glm-5.3`, validates bounded JSON and source references where supported, and falls back to deterministic evidence or a clear unavailable state when an optional LLM feature fails.
- **Separate older service:** `RUNPOD_ENDPOINT_ID` and `runpod/handler.py` are for an optional synthetic Random Forest career service; **do not claim this handler is the GLM deployment or is running unless verified**.
- **Endpoint policy:** Use your own authorised key/endpoint or explicit team permission. API keys alone do not grant access to someone else's endpoint; usage may incur charges.

**Existing proof-of-use file:** [`submission/RUNPOD PROOF OF USE.pdf`](submission/RUNPOD%20PROOF%20OF%20USE.pdf). Check the PDF and current provider console to verify the actual RunPod workload and deployment details before declaring them to judges.

## Optional Tavily course discovery

For source-backed **web course discovery**, get your **own** API key at [Tavily](https://www.tavily.com/) and set:

```dotenv
TAVILY_API_KEY=YOUR_OWN_PRIVATE_TAVILY_KEY
FEATURE4_DYNAMIC_DISCOVERY_ENABLED=true
```

Restart the backend. The pathway's Tavily Search and Extract operations are **bounded, conditional and provider-dependent**. The application checks allowed provider domains, page content, relevant skill evidence, and known/unknown access/pricing. It will still show the **reviewed local course catalogue** if Tavily is unconfigured or fails. Unknown pricing and suggested related learning are labelled as such; **search snippets alone are not proof of course coverage**. There is no promise of completely covering every ESCO gap, or of no provider charges. Keep credentials in `.env`, never in Git.

## Try the included CV examples

The three **fictional, text-based, one-page PDFs** are included only as test fixtures at [`docs/demo-cvs/`](docs/demo-cvs/). They contain **no real person's data**. The two `VALID` files represent positive résumé-format examples; the `INVALID` file is a **negative test** of the document-checking flow.

| File | Test intent | Expected user action |
| --- | --- | --- |
| [`01_VALID_Data_Analyst_Intern.pdf`](docs/demo-cvs/01_VALID_Data_Analyst_Intern.pdf) | Fictional data analyst intern résumé | Attempt CV Fast Track and review the extracted details/ESCO skills before saving |
| [`02_VALID_Student_Software_Developer.pdf`](docs/demo-cvs/02_VALID_Student_Software_Developer.pdf) | Fictional student software developer résumé | Attempt CV Fast Track and inspect field/skill evidence |
| [`03_INVALID_Not_A_CV_Event_Agenda.pdf`](docs/demo-cvs/03_INVALID_Not_A_CV_Event_Agenda.pdf) | Fictional event agenda, **not** a résumé | Confirm that non-CV content is rejected or leads to a clear manual-registration recovery route; report any incorrect acceptance as a validation bug |

**How to test:** Open `http://localhost:3000/register` → choose **CV Fast Track / Import CV** → select a file → confirm the **fictional demo / RunPod processing consent** → start extraction → inspect the review screen. Accept/edit the detected details and skills before saving. The RunPod-assisted flow needs a **working, authorised GLM endpoint**; with no RunPod configuration, use **manual registration** instead. Files must be text-selectable PDF/DOCX, **2 MiB or smaller**; scanned images have no OCR support. An intentionally invalid but text-readable agenda can be rejected by the document-content checks, not just its PDF extension. Generative model responses may vary, so names of these files are **test intentions, not guaranteed results**.

The uploaded source PDF bytes are processed transiently by the backend, not stored as uploaded files in the profile database. For the RunPod-assisted CV flow, extracted text is transmitted to the configured provider after consent. See `src/api/registration_cv_async.py` and `src/services/registration_cv.py`.

## What works without API keys?

| Works locally without RunPod/Tavily | Requires a provider or an existing sourced snapshot |
| --- | --- |
| Home, saved fictional profile, manual registration, CV Studio | RunPod-assisted CV Fast Track / AI skill extraction |
| ESCO-backed skill search, Role Matching, Career Details' deterministic matrix | RunPod-generated explanations, skill bridges and optional chapter insights |
| Reviewed local reskilling catalogue, gaps and planning logic | New Tavily-discovered courses / certifications |
| Career Simulator graph, timeline, skill milestones, local SQLite saving | Remote research/job **refreshes** require available public upstream services; previously saved snapshots can be viewed offline |
| Employer fictional department summaries / coverage counts | Optional RunPod-generated employer learning ideas |

An API key or provider connection is **never required merely to open the home page**. Source-backed indicators can show **unavailable** if they have not yet been refreshed or verified.

## Tests and verification

From the repository root, install backend test dependencies if needed:

```bash
python -m pip install -r requirements-dev.txt
python -m unittest discover -s tests
npm --prefix src/frontend run test:logic
npm --prefix src/frontend run test:components
npm --prefix src/frontend run typecheck
npm --prefix src/frontend run build
```

Optional browser E2E suite:

```bash
npm --prefix src/frontend run test:e2e
```

Playwright may require a local browser installation. From `src/frontend`, run `npx playwright install chromium` before E2E tests if Chromium is missing. Tests commonly use temporary SQLite databases and **mocked/disabled provider keys**; a passing test run **does not confirm** live RunPod/Tavily account access, credits, or public deployment readiness. For more detail, see [`docs/testing.md`](docs/testing.md) and [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Troubleshooting

| Symptom | Likely issue / fix |
| --- | --- |
| `npm run dev` says it cannot start Python | Create `.venv`, install `requirements.txt`, or set `PYTHON_EXECUTABLE` to your interpreter |
| `ModuleNotFoundError` / `uvicorn` missing | Verify Python virtual environment and backend dependency installation |
| `next` missing or frontend won't compile | Run `npm --prefix src/frontend ci` from the repository root |
| Port 3000 or 8080 is in use | Stop the existing processes or change frontend `--port` and `API_PORT` |
| Frontend displays failed API requests | Check `http://127.0.0.1:8080/api/healthz` and the FastAPI terminal; avoid starting only Next.js without the backend |
| RunPod `not configured`, `401`, `403` or `404` | Check **your own** key, its permissions, model endpoint availability and `RUNPOD_LLM_ENDPOINT_ID`. **A key does not grant access to the team endpoint by default** |
| RunPod times out / invalid explanation | Retry an explicitly supported failed action; model queues, deadlines and strict evidence validation can reject output. Deterministic evidence remains usable |
| Tavily returns no courses | Key, quota, provider whitelist, extraction/verification rules or incomplete catalogue coverage; local reviewed sources remain available |
| CV upload reports no selectable text | Use a text-based PDF or DOCX; scans are unsupported (no OCR) |
| `INVALID` agenda was accepted | Report as a document-classification defect; do not interpret acceptance as proof that it is a CV |
| Simulator plan disappears on another browser | Its demo capability is browser-scoped, **not authenticated cloud sync**; use the original browser/device with its saved profile |

## Privacy, evidence, and limitations

- **Fictional-data policy:** do not upload real CVs, real employee records, secrets or other sensitive personal information. Existing login/register screens do not implement production identity management. Employer pages lack real HR/tenant access controls.
- **Local persistence:** fictional profiles, a single career-simulator journey per profile, and selected evidence snapshots/jobs are kept in a local SQLite database (default `src/data/future_ready.sqlite3`, configurable with `APP_DB_PATH`). Browser-side demo identifiers/capabilities are **not substitutes for authentication**. No production retention or backup guarantee is provided.
- **AI boundaries:** GLM text is optional, may be unavailable or rejected by evidence validators, and is not proof of skill mastery, job readiness, replacement risk or hiring outcomes. Do not infer provider availability merely because the model name and endpoint defaults exist in source code.
- **Research and job-feed boundaries:** OpenAlex counts indexed scholarly publication activity, not employer demand; Remote OK / Himalayas are bounded job-board samples, not representative national/global hiring measures. Some disruption analysis may use additional versioned third-party research with separate limitations (see source disclosures in the UI).
- **Synthetic boundaries:** older Random Forest career matching and scenario forecasts train on synthetic CSVs in `data/`; synthetic SDG mappings are illustrative. These are not observed labour-market forecasts or measured SDG impacts. **ESCO Role Matching is a different, deterministic service.**
- **Licensing:** application source code is Apache-2.0; ESCO, OpenAlex, provider curricula, job feeds, model weights and service APIs have **separate reuse terms**. See [`docs/DATA_SOURCES_AND_LICENSES.md`](docs/DATA_SOURCES_AND_LICENSES.md), [`docs/employment-source.md`](docs/employment-source.md), and the original provider links.
- **No guaranteed free inference:** RunPod/Tavily may require accounts, billing, credits, endpoint ownership and compatible model deployment. Keep keys out of frontend bundles and source control.

## Challenges and learnings

- **Integrating previously separate modules:** Kept different profile contracts, frontend route groups and matching/AI semantics distinct rather than merging incompatible concepts into one misleading score. See [`docs/architecture.md`](docs/architecture.md).
- **Grounding generative results:** RunPod output can be slow, unavailable or fail strict evidence checks; async job handling, saved-state validation and deterministic fallback keep factual ESCO records separate from optional interpretations.
- **Learning-resource quality:** Tavily search hits alone do not prove curriculum coverage, pricing, prerequisites or official provider identity. The resource verification layer and honest incomplete-coverage labels reduce overclaiming.
- **Privacy versus demo convenience:** Fictional profiles are suitable for a hackathon walkthrough, but browser-scoped simulator capabilities and local SQLite cannot substitute for production identity/tenant security.

These are repository-documented engineering challenges and safeguards; they are not independently measured improvements in hiring outcomes.

## Future improvements

- [ ] Add verified authentication, per-user ownership, account recovery and suitable data retention controls before accepting real CVs or employer records.
- [ ] Verify a durable Replit deployment and share stable judges' access and health-check URLs.
- [ ] Improve source coverage and external validity with representative, licensable data; distinguish labour-market evidence from research and synthetic demonstrations.
- [ ] Validate model/service availability, cost, terms and quality with an authorised RunPod endpoint and tested Tavily configuration.
- [ ] Conduct accessibility, cross-device, load and external user tests before production use.

## Team roster

| Name | Role | GitHub |
| --- | --- | --- |
| Ooi Wei Lun | Team leader — exact technical role **[TEAM TO CONFIRM]** | **[TEAM TO ADD]** |
| **[TEAM TO ADD MEMBER 2]** | **[TEAM TO CONFIRM]** | **[TEAM TO ADD]** |
| **[TEAM TO ADD MEMBER 3]** | **[TEAM TO CONFIRM]** | **[TEAM TO ADD]** |

## Submission checklist

The following are **review items**, not claims of completed submissions. Tick them only after the team verifies the corresponding item.

- [ ] Team name, Domain 1, SDG 4 and individual roster details are accurate.
- [ ] Live demo, slide deck, demo video, Replit project and (if required) permitted RunPod endpoint links are added and accessible to judges.
- [ ] Replit use and [`submission/REPLIT PROOF OF USE.pdf`](submission/REPLIT%20PROOF%20OF%20USE.pdf) are verified and declared.
- [ ] RunPod use and [`submission/RUNPOD PROOF OF USE.pdf`](submission/RUNPOD%20PROOF%20OF%20USE.pdf) are verified and declared.
- [ ] Preliminary proposal is completed, exported to the organiser's required PDF format and stored in `submission/` under its required team-specific name.
- [ ] Technical Tools Declaration is completed, exported to PDF and stored in `submission/` under its required team-specific name.
- [ ] The team confirms official file naming, submission deadlines, sponsor/resource status and applicable licences/terms.
- [ ] Local or Replit launch steps were tested on a clean checkout.
- [ ] No `.env`, keys, credentials, personal data or unapproved provider terms are exposed in tracked files or links.

## Sources, licences, and contributors

- **Official occupation/skill taxonomy:** [ESCO](https://esco.ec.europa.eu/en), pinned English **v1.2.1** index and its manifest in `data/index/`.
- **Research and posting feeds:** [OpenAlex](https://openalex.org/), [Remote OK](https://remoteok.com/), [Himalayas](https://himalayas.app/); attribution/access conditions apply separately.
- **Learning content:** links to reviewed official educational providers, including Microsoft Learn, Google ML Crash Course, Python documentation, MDN, PostgreSQL, Pro Git and Harvard CS50. Provider licensing applies; this repository generally stores links and metadata, not reproduced course bodies.
- **Optional service documentation:** [RunPod](https://docs.runpod.io/), [Tavily](https://docs.tavily.com/).
- **Design/development:** Next.js, React, TypeScript, FastAPI, Pydantic, scikit-learn and SQLite. See repository dependency manifests for installed versions.
- **Team:** **3AM**, Asia Pacific University (APU), SDC Hackathon 2026, Domain 1 / SDG 4. Team leader: **Ooi Wei Lun**.

The app's code is available under [Apache License 2.0](LICENSE). Third-party content and cloud/model terms remain independent. The repository is a **research/hackathon demonstration, not career or hiring advice**.

## License

Project-owned application code is licensed under [Apache License 2.0](LICENSE). ESCO data, OpenAlex metadata, job feeds, referenced learning content, hosted models, and third-party dependencies retain **their respective licences, attribution rules and service terms**. See [`docs/DATA_SOURCES_AND_LICENSES.md`](docs/DATA_SOURCES_AND_LICENSES.md).
