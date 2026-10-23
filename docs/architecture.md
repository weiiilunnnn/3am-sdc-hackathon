# Architecture and code organisation

## Product boundary

This is the 3AM team's Aiversecity Future-Ready Workforce Domain 1 prototype. It is separate from Talent Bank and CareerOS. The six eventual competition capabilities are skills profile intake, AI-trend signals, explainable future-role matching, personalised reskilling, SDG mapping, and multiple future scenarios. The workspace implements the first two. Main’s career/SDG/scenario pages are preserved as an illustrative demo; they are not personalised model-backed capabilities.

## Active application structure

```text
src/
├── main.py                 FastAPI app and API entry point
├── api/                    FastAPI routers for profiles, CV extraction, and trends
├── models/                 Pydantic request and response models
├── services/               Profile, CV extraction, indicator, trend, and storage logic
│   └── sources/            Separate research/employment contracts and adapters
├── data/                   Topic definitions, local skill vocabulary,
│                           fictional sample profiles, SQLite file
└── frontend/
    ├── app/                Home, profile, CV Studio, Outlook, Explorer, and source pages
    └── lib/                API client and frontend validation/chart helpers
```

Keep all application source code under `src/`. Root-level tests, documentation, package configuration, and Replit instructions are repository tooling, not application source.

## Request and data flow

- The Next.js frontend uses the `/api` path. `src/frontend/next.config.ts` proxies these requests to FastAPI in the development setup.
- FastAPI is created in `src/main.py`; profile and trend routes are registered from `src/api/`.
- Request/response validation belongs in Pydantic models under `src/models/`. Business rules and persistence belong in `src/services/`.
- The CV endpoint accepts bounded raw PDF/DOCX request bytes only after synthetic-demo confirmation. `src/services/cv_extractor.py` extracts text in memory and returns a review payload; it does not write the uploaded file or extracted draft to SQLite.
- Profile skill extraction sends only selected profile summary, record descriptions, work activities, and transferable strengths to the configured RunPod language-model endpoint after an explicit fictional-data/processing confirmation. The response is constrained to IDs in the current local taxonomy; quoted evidence is checked against the submitted text. Candidates remain transient until a user reviews them, adds them to the unsaved profile, chooses proficiency, and saves. Registration starts with an editable fictional sample designed to support up to ten taxonomy suggestions; model output may be fewer and is not guaranteed.
- The extraction service does not persist submitted text or candidate output. Text is sent to RunPod, so the endpoint's configured provider data-retention terms apply. Do not submit real CVs or personal information; the profile prototype remains synthetic-only.
- SQLite is the prototype database. It defaults to `src/data/future_ready.sqlite3`; `APP_DB_PATH` can select another path. SQLite files are excluded from Git.
- Profile additions are backward-compatible defaults in the stored JSON payload; the feature adds no relational-table migration. Stable IDs identify user-editable education, experience, project, certification, and achievement records.
- Research adapters return the provider-independent `SourceResult` contract from `src/services/sources/base.py`; OpenAlex supplies annual research counts.
- Employment adapters use the independent `EmploymentSource`/`EmploymentResult` contract in `src/services/sources/employment_base.py`. Remote OK supplies a bounded posting snapshot. Its cache and refresh state use separate SQLite tables; employment records are never inserted into research observations.
- Employment GET routes are cache-only; explicit POST refresh is globally limited to one attempt per 24 hours and atomically replaces a validated snapshot. Failures retain the old snapshot and last-success date.
- Profile data is fictional-only. No authentication or real-person-data workflow is provided.
- Profile indicators are deterministic content checks. The frontend reads cached signals on page load; it does not refresh OpenAlex or Remote OK when the user browses.

## Current data limitations

OpenAlex query counts describe indexed research activity, not labor-market demand. Remote OK indicators count configured keyword mentions in a single remote-board sample, not global demand or historical growth. Source IDs, URLs, dates, evidence and snapshot provenance are retained. See [the source assessment](employment-source.md).

The current taxonomy is a small local vocabulary, not an active ESCO integration. Extracted skill IDs are local prototype IDs, not KW/ESCO identifiers. AI extraction requires `RUNPOD_API_KEY` and uses `RUNPOD_LLM_ENDPOINT_ID` when set; it has no silent local or rule-based fallback. See [Features 1–2 notes](features-1-2.md) and [the data-source template](data-source-template.md).

## Frontend integration and tooling

The frontend is a standalone npm package at `src/frontend/`, matching main’s package boundary. The backend remains FastAPI with SQLite; the unused root workspace, generated API packages, Drizzle database scaffold, mockup sandbox and tracked migration backups were removed after checking application imports.

`app/(pathwaay)/` contains main’s onboarding, login and career explorer with its original root layout and stylesheet. `app/(workspace)/` contains SH’s profile, home, CV Studio, outlook, skill explorer and radar with their existing layout and stylesheet. Separate root layouts deliberately cause a full document navigation between groups to avoid global CSS collisions. The group names do not affect URLs.

`/` redirects to `/register` as in main. `/profile` displays the completed onboarding profile; it no longer falls back to the separate legacy profile-intake form. `/profile/edit` edits that same session profile. Workspace links target the completed profile or its edit view. The demo onboarding does not write to the profile API or implement authentication; its demo email, selected skill names, and taxonomy links are carried in session storage only. Email is excluded from AI extraction. Login fields use clearly fictional prefilled values and do not authenticate. Existing API contracts are unchanged.

`runpod/handler.py` is main’s placeholder, restored verbatim and not imported by FastAPI. `scripts/dev.py` starts and supervises the two development services, including for the Replit Run button. No automatic Drizzle migration or production deployment is configured.

`src/frontend/AGENTS.md` is generated by Next.js; preserve it and consult its local documentation before frontend work. See [branch integration](branch-integration.md) for the comparison and migration decisions.
