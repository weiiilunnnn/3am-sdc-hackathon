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
- SQLite is the prototype database. It defaults to `src/data/future_ready.sqlite3`; `APP_DB_PATH` can select another path. SQLite files are excluded from Git.
- Profile additions are backward-compatible defaults in the stored JSON payload; the feature adds no relational-table migration. Stable IDs identify user-editable education, experience, project, certification, and achievement records.
- Research adapters return the provider-independent `SourceResult` contract from `src/services/sources/base.py`; OpenAlex supplies annual research counts.
- Employment adapters use the independent `EmploymentSource`/`EmploymentResult` contract in `src/services/sources/employment_base.py`. Remote OK supplies a bounded posting snapshot. Its cache and refresh state use separate SQLite tables; employment records are never inserted into research observations.
- Employment GET routes are cache-only; explicit POST refresh is globally limited to one attempt per 24 hours and atomically replaces a validated snapshot. Failures retain the old snapshot and last-success date.
- Profile data is fictional-only. No authentication or real-person-data workflow is provided.
- Profile indicators are deterministic content checks. The frontend reads cached signals on page load; it does not refresh OpenAlex or Remote OK when the user browses.

## Current data limitations

OpenAlex query counts describe indexed research activity, not labor-market demand. Remote OK indicators count configured keyword mentions in a single remote-board sample, not global demand or historical growth. Source IDs, URLs, dates, evidence and snapshot provenance are retained. See [the source assessment](employment-source.md).

The current taxonomy is a small local vocabulary, not an active ESCO integration. RunPod is reserved for possible later work and is not used by the active app. See [Features 1–2 notes](features-1-2.md) and [the data-source template](data-source-template.md).

## Frontend integration and tooling

The frontend is a standalone npm package at `src/frontend/`, matching main’s package boundary. The backend remains FastAPI with SQLite; the unused root workspace, generated API packages, Drizzle database scaffold, mockup sandbox and tracked migration backups were removed after checking application imports.

`app/(pathwaay)/` contains main’s onboarding, login and career explorer with its original root layout and stylesheet. `app/(workspace)/` contains SH’s profile, home, CV Studio, outlook, skill explorer and radar with their existing layout and stylesheet. Separate root layouts deliberately cause a full document navigation between groups to avoid global CSS collisions. The group names do not affect URLs.

`/` redirects to `/register` as in main; the existing SH profile editor now lives at `/profile`. Workspace links have been updated. Both sections link to each other. The demo onboarding does not write to the profile API or implement authentication. Existing saved profile IDs and backend contracts are unchanged.

`runpod/handler.py` is main’s placeholder, restored verbatim and not imported by FastAPI. `scripts/dev.py` starts and supervises the two development services, including for the Replit Run button. No automatic Drizzle migration or production deployment is configured.

`src/frontend/AGENTS.md` is generated by Next.js; preserve it and consult its local documentation before frontend work. See [branch integration](branch-integration.md) for the comparison and migration decisions.


## Additional KW workflow after integration

The sections above describe main's preserved workspace and page families.
The nested `(workspace)/(future-ready)` group provides `/role-matching` and its
details/pathway screens inside the existing workspace AppShell. All public URLs
and the `/` to `/register` redirect remain unchanged. Role Matching stays active
for nested screens. Feature CSS is scoped to `.future-role-ui`, preserving other
workspace pages; its API helper remains independent.

KW endpoints are registered by `src/api/future_roles.py`. Contracts live in
`src/models/future_roles.py` and `future_role_discovery.py`; services live in
`src/services/future_roles/`, with the ESCO provider in `services/sources/esco.py`.
KW-local compatibility exports preserve existing service logic without adding
exports to main's model package. A read-only workspace-profile adapter resolves
claimed skills against ESCO; unknown or ambiguous labels remain unscored. Main's synthetic career/scenario outputs, source
observations and KW's ESCO relevance retain their different meanings.

The additional ESCO reference data and reviewed learning resources are under
root `data/`; they do not replace SQLite or main's synthetic datasets. See
[the merge report](MAIN_KW_MERGE_REPORT.md) for preservation and validation.
