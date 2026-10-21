# SH alignment with main

Compared SH `35dc13588dba7ab2df571eea984917abf7bf8f2a` with main/WL `e6cbf66dab1221a1acd5bed729d232367b84adfa` and KW `a31ffe457800de6d5c0530261f2ac752ccdc2614` on 2026-10-21. Main and WL were identical; KW had the same compact package structure. The initial alignment integrated the main snapshot into SH’s working tree. A subsequent merge of main into SH records that integration in Git history and resolves the old-path conflicts for PR #2; no history was rewritten.

## Preserved

- All SH API routes, models, source adapters, SQLite storage, fictional samples, CV extraction, profile evidence, frontend features and tests.
- SH’s pinned frontend versions and development-only test tools.
- Main’s `/register`, `/login`, `/explorer`, root redirect and their visual design, isolated in a route group.
- Main’s RunPod placeholder, without activating it or adding it to FastAPI requirements.
- Submission documents, team docs and repository agent guidance.

## Reconciled

- Main owns `/` → `/register`. SH’s former root profile editor is `/profile`; internal links and tests follow it.
- `/explorer` remains the illustrative career demo. `/explore` remains the evidence-aware skill catalogue. Neither replaces the other.
- Each page family has its own root layout and CSS. Crossing between them reloads the document; profile persistence remains unchanged.
- Both page families have links to the other. Onboarding remains an in-memory preview; no authentication or automatic profile migration is implied.
- Frontend installation uses `src/frontend/package-lock.json` and npm. Pinned versions are kept instead of main’s floating `latest` declarations.
- Replit development directly starts Next.js and FastAPI through `scripts/dev.py`, replacing wrappers and the unrelated database migration hook.

## Removed after dependency inspection

- `.migration-backup/`: tracked historical copies; recoverable in Git.
- `artifacts/mockup-sandbox/`: separate mockup app, not imported by the application.
- Other `artifacts/`: wrappers replaced by the direct development launcher.
- Root `lib/`: unused generated clients/specs/Zod and Drizzle scaffold; the live frontend uses `src/frontend/lib/api.ts` and the backend uses SQLite.
- Root pnpm manifests, TypeScript project references and npm workspace settings: only supported the removed packages.
- Old workspace scripts, attachment text and artifact deployment metadata.

Historical verification reports retain their original commands and results; README.md and docs/testing.md describe the current setup. Live data refreshes, RunPod deployment, authentication and production hosting are outside this structural integration.

## Verification performed

- Standalone clean install: `npm --prefix src/frontend ci --ignore-scripts` passed. npm reported zero vulnerabilities at this run.
- Python unittest suite: 45 passed.
- Frontend logic suite: 6 passed; existing Node module-type warning remains.
- React rendering suite: 6 passed.
- Frontend TypeScript check and Next.js production build passed, including all restored and preserved routes.
- HTTP smoke checks: all nine non-root page routes and five read-only API endpoints returned 200; `/` redirected to `/register`.
- Browser journey: welcome → workspace → profile; loaded a fictional sample, edited it, saved it, reloaded, visited the career explorer, selected a career, and returned to the workspace with the saved profile intact.
- Browser inspection covered the narrow default viewport and a 1280px desktop workspace; no browser console errors were recorded in the checked journey. Profile root links and section anchors were checked after migration.
- Development launcher started both services; interrupting it closed both ports (3000 and 8080).
- All 31 backend/source-data/requirements files checked against SH were byte-for-byte unchanged. The RunPod handler matches main.

Not verified: live provider refreshes, actual Replit hosting/deployment, authentication, every CV upload/print flow, and exhaustive browser coverage of the restored onboarding/scenario demo. The saved integration-demo profile is local ignored SQLite data and is excluded from deliverables.

## PR merge conflict resolution

Merged main `e6cbf66` into SH after the structural integration. Kept the integrated route-group pages and removed the duplicate top-level routes reintroduced by the merge. Retained the separate root layouts and stylesheets and adopted main’s shared Pathwaay icon. No backend or profile-storage changes were needed.
