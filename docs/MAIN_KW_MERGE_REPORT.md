# main into KW: integration review

Date: 2026-10-22 (Asia/Kuala_Lumpur). Implementation complete; merge remains
uncommitted on KW pending user review. No push, merge abort, reset or deployment.

## Protected merge state

- KW parent: `cfd34e71e5c41e92627cbf3445dd941e0cb907c1`.
- Incoming main: `88eb7fb7182e7d0ce532682ca8ce896ed800e224`.
- Common ancestor: `a31ffe457800de6d5c0530261f2ac752ccdc2614`.
- `backup-KW-before-merge` points to the KW parent.
- Initial status and all 14 unresolved paths/stages were recorded in the ignored
  `.cache/merge-integration-before.json`. All 14 conflicts are resolved.

## Foundation and integration

Main remains the foundation. Its `/` -> `/register` redirect, both existing
route groups and all existing page URLs remain intact. KW's page, original
layout and CSS are isolated in `(future-ready)` at `/role-matching`. One item
was added to the existing workspace navigation; its prior items/actions remain.

Main's FastAPI construction, SQLite lifespan, six existing routers and utility
routes are retained. A new `src/api/future_roles.py` router carries KW's original
handlers. The public schema contains 38 HTTP method/path operations. The legacy,
v2, v2.1, pathway, source and explicit ESCO provider contracts remain available.

KW definitions moved to `src/models/future_roles.py` and
`src/models/future_role_discovery.py`. Main's model package exports and existing
model modules are unchanged. KW services are isolated in
`src/services/future_roles/`; its two small compatibility modules preserve their
relative imports. The ESCO client is `src/services/sources/esco.py`. All callers,
mock targets and repository scripts use the appropriate new namespaces.

Main's frontend API helper is unchanged. KW uses
`src/frontend/lib/future-role-api.ts`; only its consumers' imports changed.
Saved/local-vocabulary profiles are not silently converted into ESCO profiles.
Synthetic career probabilities/scenarios, source observations and ESCO relevance
retain their separate meanings.

## Existing main files changed and why

| File | Integration-only change |
| --- | --- |
| `.gitignore` | Add KW browser/build/environment exclusions. |
| `README.md` | Append KW scope, route, tests, source distinctions and Windows startup notes. |
| `docs/architecture.md` | Append the isolated KW namespace/route/data architecture. |
| `docs/testing.md` | Append the combined suite commands and isolated-browser details. |
| `src/main.py` | One new router import and one registration. |
| `src/frontend/app/(workspace)/AppShell.tsx` | One navigation entry for `/role-matching`. |
| `src/frontend/next.config.ts` | Optional `NEXT_DIST_DIR`; normal default remains `.next`. |
| `src/frontend/tsconfig.json` | Retain KW's two isolated browser-build type includes. |
| `src/frontend/package.json` | Add the existing KW Playwright dependency and E2E script. |
| `src/frontend/package-lock.json` | Regenerate consistently; three Playwright package entries added, no existing main package version changed. |

Main's `.replit`, `requirements.txt`, `.env.example`, Docker files, API helper,
Pathwaay layout, model implementations, provider adapters and existing API test
file retain incoming main's contents. All main package scripts and pins are
preserved, including TypeScript 5.9.3, tsx, Next and React.

## Conflict decisions (all resolved)

- `.gitignore`: incoming plus minimal KW exclusions.
- `.replit`: incoming unchanged.
- `README.md`: incoming unchanged prefix plus integration appendix.
- `requirements.txt`: incoming unchanged; existing KW test dependency remains in
  `requirements-dev.txt`.
- `src/__init__.py`: incoming unchanged.
- `(pathwaay)/layout.tsx`: incoming unchanged; KW layout copied to its own group.
- Root `app/globals.css` and `app/page.tsx`: keep main's deletion at those paths;
  retain the complete KW implementations at their new route-group paths.
- `lib/api.ts`: incoming unchanged; separate KW helper.
- `next.config.ts`: incoming plus isolated build directory option.
- Package manifest/lockfile: incoming versions/scripts plus KW's test tooling.
- `src/main.py`: incoming plus additional router registration.
- `tests/test_api.py`: incoming unchanged; KW's seven tests are retained in
  `tests/test_future_roles_api.py`.

## Preservation checks

- All 22 KW data blobs and all 5 incoming main data blobs match their respective
  Git parent objects. No dataset regeneration, ESCO download or data conversion.
- All 15 exported KW JSON contract schemas match the canonical relocated models.
- Matching, relevance/search, skills intake, trend adapter, reskilling and
  learning-time implementations retain their original bytes at the new paths.
  The data loader changes only its relative repository-root calculation.
- The reskilling integrity test retains historical hashes at relocated paths;
  for PathwayView it allows only the explicit API-helper import relocation.
  Its rendering and pathway logic remain unchanged. No historical baseline
  expected hash was replaced.
- All pre-existing Python test cases remain present. The integrity test was
  renamed to describe that approved import-only compatibility change.
- Historical screenshots regenerated by E2E were restored to their original
  committed contents rather than introducing unrelated binary changes.

## Executed verification

| Check | Result |
| --- | --- |
| Main API focused suite | 9 passed |
| KW API focused suite | 7 passed |
| Final combined Python regression | 122 passed, 18.317 seconds |
| Main frontend logic suite | 6 passed |
| Main frontend component rendering suite | 6 passed |
| Next route type generation + TypeScript | Passed; final post-browser typecheck also run |
| Next production build | Passed; all prior routes and `/role-matching` generated |
| Original KW browser scenarios | 14 passed in the combined run |
| Added main/cross-branch browser scenarios | 2 passed on focused recheck, 26.4 seconds overall |
| Clean npm install | Passed, retaining all incoming package versions |
| `pip check` / `npm ls --depth=0` | Passed |
| Data/schema preservation | 27 data blobs and 15 schemas matched |

The full browser run initially passed 14/16. The two new tests needed an initial
onboarding-visible navigation selector and a realistic cold-index wait; those
test-only corrections passed on the focused recheck. The entire browser suite
was not rerun again. The first combined backend run passed 121/122; the failing
historical byte check exposed CRLF conversion in PathwayView. Restoring its LF
line endings resolved it; the final complete backend run passed all 122.
Initial TypeScript errors came from stale generated root-page types; only
validated generated type directories were removed and current routes regenerated.
No application guards or existing tests were removed to obtain these results.

New API checks exercise actual local synthetic model training/inference in a
temporary model directory, both scenarios, mocked optional RunPod success/error,
SDG reference validation, and the combined route schema/lifespan. Browser checks
verify every existing route, the root redirect, profile load/edit/save/reload,
the added navigation, mobile width and saved-profile persistence across groups.
All browser SQLite/model storage is temporary; paid-service credentials are empty.

## Limits and remaining risks

- No live OpenAlex/Remote OK refresh, live ESCO call, RunPod inference, Docker
  image build/deployment or Replit hosting was performed. Those main files and
  behaviours were preserved; provider tests use mocks and local fixtures.
- Browser coverage does not exhaust every CV printing/template and generated
  SDG explanation interaction. Existing unit/API/component coverage is retained.
- Main's development launcher is POSIX-specific. It is unchanged; use the
  documented two-terminal Windows commands. No deployment or authentication
  configuration was added.
- Main's saved profiles and KW's temporary ESCO intake remain independent;
  automatically linking them requires an explicitly reviewed adapter.
- Existing ESCO resource-coverage limits and synthetic-model limitations remain.
- The whole-merge whitespace check retains one pre-existing incoming blank line
  at EOF in `src/frontend/app/(workspace)/profile-workspace.ts`; that main file
  was intentionally left unchanged. Comparing against incoming main additionally
  reports 11 pre-existing trailing-space lines in two preserved KW handoff
  documents. Those documents were not reformatted; neither check found a new
  implementation whitespace defect.

## Review artifacts and running

Final staged patch, incoming-main-only changes, status and summary are written
under ignored `.cache/merge-final.patch`, `.cache/merge-main-foundation.patch`,
`.cache/merge-final-status.txt`, and `.cache/merge-final-summary.txt`.
These are local review artifacts, not additional application files.

Windows: install `requirements-dev.txt` in the virtual environment and use
`npm.cmd --prefix src/frontend ci`. In one terminal run:

```powershell
.\.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 8080 --reload
```

In another terminal:

```powershell
$env:BACKEND_URL = "http://127.0.0.1:8080"
npm.cmd --prefix src/frontend run dev
```

Open `/` for main's onboarding, `/home` for its workspace, or `/role-matching`
for the isolated KW workflow. No commit or push has been made; review and explicit
approval are required before completing the merge commit.
