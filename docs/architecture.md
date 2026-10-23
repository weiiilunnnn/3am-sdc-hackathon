# Architecture and code organisation

## Product boundary

This is the 3AM team's Aiversecity Future-Ready Workforce Domain 1 prototype. It is separate from Talent Bank and CareerOS. The six eventual competition capabilities are skills profile intake, AI-trend signals, explainable future-role matching, personalised reskilling, SDG mapping, and multiple future scenarios. The workspace implements the first two. Main’s career/SDG/scenario pages are preserved as an illustrative demo; they are not personalised model-backed capabilities. Role Matching's SDG view prefers role-specific synthetic mappings and, when those are absent, can show exact current-profile-skill mappings with an explicit notice that they are not occupation-specific evidence. The fallback matches role and skill names case-insensitively after whitespace normalization, deduplicates each skill/target pair using its largest curated synthetic alignment weight, and includes only exact skill-name matches.

## Active application structure

```text
src/
├── main.py                 FastAPI app and API entry point
├── api/                    FastAPI routers for profiles, employer view, CV extraction, and trends
├── models/                 Pydantic request and response models
├── services/               Profile, employer aggregates, CV extraction, indicator, trend, and storage logic
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
- Profile skill extraction sends only selected profile summary, record descriptions, work activities, and transferable strengths to the configured RunPod language-model endpoint after an explicit fictional-data/processing confirmation. It retrieves at most 80 candidates from the verified local ESCO v1.2.1 English snapshot and accepts only supplied canonical ESCO skill IDs; quoted evidence is checked against the submitted text. The API returns a transient job ID immediately and the frontend polls for completion; a bounded in-process worker pool allows the provider request up to 90 seconds without making the browser wait on one long request. Jobs are process-local and are lost if the API process restarts, so this prototype requires a single API process for polling to remain reliable. Completed suggestions remain transient until a user reviews them, adds them to the unsaved profile, chooses proficiency, and saves. ESCO IDs are validated and preserved through SQLite and the KW profile adapter. Extraction fails explicitly if the verified full snapshot is unavailable; it does not fall back to the prototype vocabulary. Registration starts with an editable fictional sample designed to support up to ten taxonomy suggestions; model output may be fewer and is not guaranteed.
- The extraction service does not persist submitted text or candidate output. Text is sent to RunPod, so the endpoint's configured provider data-retention terms apply. Do not submit real CVs or personal information; the profile prototype remains synthetic-only.
- SQLite is the prototype database. It defaults to `src/data/future_ready.sqlite3`; `APP_DB_PATH` can select another path. SQLite files are excluded from Git.
- Profile additions are backward-compatible defaults in the stored JSON payload; the feature adds no relational-table migration. Stable IDs identify user-editable education, experience, project, certification, and achievement records.
- Research adapters return the provider-independent `SourceResult` contract from `src/services/sources/base.py`; OpenAlex supplies annual research counts.
- Employment adapters use the independent `EmploymentSource`/`EmploymentResult` contract in `src/services/sources/employment_base.py`. Remote OK supplies a bounded posting snapshot. Its cache and refresh state use separate SQLite tables; employment records are never inserted into research observations.
- Employment GET routes are cache-only; explicit POST refresh is globally limited to one attempt per 24 hours and atomically replaces a validated snapshot. Failures retain the old snapshot and last-success date.
- Profile data is fictional-only. No authentication or real-person-data workflow is provided.
- Profile indicators are deterministic content checks. The frontend reads cached signals on page load; it does not refresh OpenAlex or Remote OK when the user browses.
- The Employer View reads only `synthetic_demo=true` profiles from the shared SQLite profiles table. Department assignments and target skill IDs are stored separately in `employer_departments`, `employer_member_departments`, and `employer_department_skill_targets`. Dashboard coverage is the share of assigned profiles listing each employer-entered taxonomy skill; it is not an independently assessed skill level or a labor-market requirement.
- Employer navigation is scoped to `/employer` routes and links the dashboard, synthetic-profile directory, and a static fictional Company X IT company profile. The company profile is display-only demo content and is not stored as a registered organization in SQLite.
- Employer endpoints currently have no HR authentication, tenant boundary, or organization-level access control. They are prototype-only and must not be exposed to real employee data. The login page's Employer View link is a navigation shortcut, not an authenticated HR role.
- Employer learning plans call the configured RunPod LLM endpoint with only self-reported skill names/proficiency, target-skill names, and learning preferences. Names, profile IDs, summaries, and experience descriptions are not sent. Generated activities are not verified courses or links; outputs are validated against the selected target skill names, and provider/configuration failures are shown instead of replaced with fabricated content.

## Current data limitations

OpenAlex query counts describe indexed research activity, not labor-market demand. Remote OK indicators count configured keyword mentions in a single remote-board sample, not global demand or historical growth. Source IDs, URLs, dates, evidence and snapshot provenance are retained. See [the source assessment](employment-source.md).

The profile workspace retains a small local vocabulary for legacy entries, while registration search and AI skill extraction use the pinned full ESCO v1.2.1 snapshot. Extracted skill IDs are canonical ESCO URIs, not local prototype IDs. The snapshot is loaded locally; each extraction sends only a bounded set of relevant ESCO candidates to the model and does not call the ESCO API. AI extraction requires `RUNPOD_API_KEY` and uses `RUNPOD_LLM_ENDPOINT_ID` when set; it has no silent local or rule-based fallback. See [Features 1–2 notes](features-1-2.md) and [the data-source template](data-source-template.md).

## Frontend integration and tooling

The frontend is a standalone npm package at `src/frontend/`, matching main’s package boundary. The backend remains FastAPI with SQLite; the unused root workspace, generated API packages, Drizzle database scaffold, mockup sandbox and tracked migration backups were removed after checking application imports.

`app/(pathwaay)/` contains main’s onboarding, login and career explorer with its original root layout and stylesheet. `app/(workspace)/` contains SH’s profile, home, CV Studio, outlook, skill explorer and radar with their existing layout and stylesheet. Separate root layouts deliberately cause a full document navigation between groups to avoid global CSS collisions. The group names do not affect URLs.

`/` redirects to `/register` as in main. `/profile` displays Main?s completed onboarding profile with SQLite recovery through the existing hybrid adapter; legacy backend-only profiles retain the existing editor. `/profile/edit` saves through the same hybrid workflow. Registration keeps sessionStorage compatibility and also saves its bounded snapshot (including email and display taxonomy links) into the existing profile row. Reviewed AI suggestions and registration skill searches retain canonical ESCO v1.2.1 IDs through SQLite and the profile adapter. Email is excluded from AI extraction. Login and logout remain local demo session controls, not authenticated ownership; logout clears the session snapshot but does not delete the persisted profile or its local-device reference. See [hybrid profile integration](hybrid-profile-integration.md) for revision/idempotency contracts and limitations.

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
