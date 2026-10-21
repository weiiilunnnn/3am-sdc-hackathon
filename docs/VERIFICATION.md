# Future-Role Matching verification (latest)

Executed current baseline: 50 backend tests and 9 browser tests passed before edits. Executed focused checks: 9 discovery units, 4 official-client units, 7 full-index/API compatibility tests and 3 browser wiring/toggle/mobile tests passed. Executed one complete regression: **70 backend tests passed**, **10 Chromium browser tests passed**, **TypeScript checking passed**, **production build passed**. The browser run exposed a rendering-key warning when a broader group and fallback concept shared a URI; composite keys fixed it, followed by one targeted pagination/browser-console test passing. Complete suites were not repeatedly rerun.

Actual commands: `.\.venv\Scripts\python.exe -m unittest discover -s tests`; `npm.cmd run typecheck`; `npm.cmd run build`; `npm.cmd run test:e2e`. Existing unittest, not an unconfigured pytest runner. Test servers use 8100/3100 and .next-e2e without stopping user servers. Updated schema export produced 11 legacy and 2 discovery schemas. git diff --check passed with normal Windows line-ending notices.

The full official import completed with 3,658 occupations, 14,579 concepts and 126,051 relationships; all original 15 anchors and counts checked, no orphan/duplicate relations or import anomalies. The first large-page attempt timed out; the existing import resumed with smaller bounded pages and two requests maximum in flight. Subsequent work reused that cache; no restart/download research loop. Manifest and API-compatibility records preserve the exact provenance and missing returned-version caveat.

Thirteen synthetic profiles were evaluated locally, including software/data, web, business, one/two generic concepts, one specific concept, unknown/empty, synonym duplicates and mixed >5 skills. Actual outcomes, pure-engine and local-ASGI timings, unknown terms and zero-upstream-request checks are in discovery-evaluation.json. Matching does not fetch upstream per candidate. The 30% setting is a product heuristic; no employment accuracy or course-completion result was measured.

Pathway engine, timing module, PathwayView and reviewed resource/source catalogues remain byte-identical to future-role-baseline.json hashes. A newly discovered role outside the old subset passes through the existing pathway API with honest incomplete coverage. Legacy strict scores, trend/SDG/scenario source guards, null durations and no-fabrication behavior remain tested.

Screenshots actually captured and visually inspected: discovery-desktop.png, discovery-mobile.png, discovery-evidence.png and discovery-pathway-handoff.png in docs/screenshots. No exhaustive accessibility/security certification, production deployment or commit is claimed. Full implementation/source/algorithm/file report: FUTURE_ROLE_IMPLEMENTATION.md.

---

Historical verification follows; current results above supersede older matching behavior.

# Enhancement verification - 21 October 2026 (latest)

Existing implementation inspected before edits: Git status/current sources, FastAPI endpoints, Pydantic/TypeScript contracts, reference preparation/validation, components, browser tests and documentation. The requested docs path was missing, so the supplied Downloads enhancement request was read and copied there. Existing dirty work was preserved.

## Fresh baseline before feature changes

- `.\.venv\Scripts\python.exe -m unittest discover -s tests -v`: **39 passed**.
- Existing six Playwright workflows: **6 passed** after isolating test servers from the already-running application. This was a new execution, not reliance on the previous report.
- The first PowerShell `npm` invocation was blocked by its `.ps1` policy; `npm.cmd` works. A sandboxed browser invocation could not see the installed Chromium executable; permitted broader filesystem/process access allowed launch. A sandboxed browser-download attempt failed on network permissions and installed no browser.
- Reusing the user's development server left the browser stuck at the initial loading state, with HMR connection failures. Tests now start their own servers on **8100/3100** and use **`.next-e2e`**, without stopping the user's 8000/3000 servers. The isolated baseline passed.

## Executed enhancement checks

| Command / check | Actual result |
|---|---|
| `.\.venv\Scripts\python.exe -m unittest discover -s tests -v` | **50 passed**; later rerun after course-specific access evidence also **50 passed** |
| `.\.venv\Scripts\python.exe scripts/audit_scoring.py --output docs/scoring-audit-baseline.json` before catalogue edits | Original five roles / **15** computed persona-role pairs captured |
| `.\.venv\Scripts\python.exe scripts/audit_scoring.py` | Expanded **15 roles / 45** pairs; no alternative adopted without a domain mapping |
| `.\.venv\Scripts\python.exe scripts/report_catalogue_review.py` | Data-derived scoring audit and full role/resource inventory written |
| `.\.venv\Scripts\python.exe scripts/export_contract_schemas.py` | **11** schemas regenerated with additive fields |
| `npm.cmd run typecheck` in `src/frontend` | Passed |
| `npm.cmd run build` in `src/frontend` | Passed: production compilation, TypeScript and static page generation |
| `npm.cmd run test:e2e` in `src/frontend` | **9 Chromium tests passed**, real FastAPI + Next.js proxy on isolated ports |
| `.\.venv\Scripts\python.exe scripts/prepare_esco_subset.py --verified-date 2026-10-21` | **15** released ESCO v1.2.1 records; native IDs, titles, complete relationships, counts and raw-response hashes recorded |
| `.\.venv\Scripts\python.exe scripts/check_source_links.py` | **29/29 source-entry URL checks returned HTTP 200**, including reused content/policy URLs; not a syllabus or enrolment test |
| `git diff --check` | Passed; normal Windows line-ending notices |
| Common secret-token pattern search over authored source/data/docs/tests | No matching OpenAI/GitHub/AWS token patterns found; no credentials introduced or commit made. This is not an exhaustive security audit |

Backend coverage includes the old 3/26 = 11.54% web example; all 15 original persona-role percentages unchanged; complete/deduplicated native requirements; type counts including unknown; missing evidence; all 45 persona/role API pathways; free/budget/currency restrictions; prerequisite ordering/deduplication; provider-hour priority; eligible day/week fallbacks; configurable study days; mixed units; no capacity; large unestimated scope; and uncovered gaps independently incomplete. The runner is the repository's existing **unittest** suite.

Browser coverage includes initial top five; expanded 15-role See more and search; compact strengths/gaps; accessible bars; bottom collapsed scoring footer; searchable essential/optional requirement types with exact IDs and linked evidence; different personas; real provider links; conditional Online Courses; app estimate labels; unknown course time; collapsed uncovered gaps; synthetic A/B context preserving fit/rank; scenario context; unresolved/empty intake; service recovery; stale-response cancellation; and 390px matching/pathway overflow checks.

Intermediate enhancement failures were corrected before the passing run: tests that assumed the entire candidate set still had five roles, an obsolete expectation that Python Tutorial would win after adding CS50, and Unicode punctuation damaged by a PowerShell pipeline. The expanded dependency test exposed a real scheduling bug (previously selected prerequisites losing edges); this was fixed and all-profile ordering now passes.

Screenshots captured from actual browser tests and visually inspected: `matches-desktop.png`, `matches-mobile.png`, `requirements-expanded.png`, `pathway-desktop.png`, `pathway-estimates.png`, `pathway-mobile.png` under `docs/screenshots/`. They show synthetic people and genuine reference/resource records, not employment outcomes. Native details/inputs provide keyboard operation; no exhaustive accessibility certification is claimed.

The score audit is reproducible local calculation, not predictive accuracy validation or a load test. Course public content and mappings were reviewed separately from link availability; no course was completed, no learning mastery measured, and account/region/credential workflows were not fully tested. Real trend/SDG/numerical scenario integrations remain team dependencies. Large course/manual timing and uncovered requirements remain explicit. No production deployment or commit.

---

## Historical record: previous implementation verification

The following is retained for provenance. The enhancement counts and current catalogue above supersede the older five-role/eight-resource state.

# Executed verification - 21 October 2026

Environment: Windows/PowerShell, Python 3.12.14, Node.js 24.16.0. Local workspace only; no deployment or commit performed.

| Executed check | Actual result |
|---|---|
| `python -m pip install -r requirements-dev.txt` in `.venv` | Succeeded, including preserved RunPod SDK 1.12.0 |
| `python -m pip check` | No broken requirements found |
| `npm ci --no-audit --no-fund` in frontend | Succeeded from repaired, pinned lockfile |
| `python -m unittest discover -s tests -v` | **39 tests passed** |
| `python scripts/export_contract_schemas.py` | **11 v1 JSON Schemas exported** |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; Next.js production compilation and static page generation succeeded |
| `npm run test:e2e` | **6 Chromium tests passed**, using actual FastAPI and Next.js servers / proxy |
| `python scripts/check_source_links.py` | **12/12 learning-content/access-policy URLs returned HTTP 200** |
| `git diff --check` | Passed (normal Windows line-ending notices only) |

Browser suite covers five-role matching, changed persona rankings, real record citations, provider-linked pathways, prerequisite/time displays, invariant fit under synthetic snapshot changes, unresolved/empty intake, service-error recovery, owner-supplied illustrative scenario context and 390px mobile overflow. The server-side API suite also requests pathways for all five roles across all three personas and rejects unknown roles, invalid contracts and unsupported verified SDG claims.

Captured previews: `screenshots/matches-desktop.png`, `screenshots/pathway-desktop.png`, `screenshots/pathway-mobile.png`. Desktop and mobile screenshots were visually inspected for layout. Screenshots use synthetic profiles and genuine reference/resource records. They are not proof of source completeness or a production deployment.

Earlier failures were resolved before the final run: incomplete starter npm lockfile, sandbox access to the installed Chromium executable, an incompatible HTML number-step constraint, and a test locator that shifted when removing list items. Browser launches and required network installs used approved elevated execution because of sandbox restrictions. A cache-only npm installation could not complete; the final ordinary clean install succeeded.

## Verified data boundaries

Five ESCO v1.2.1 occupations were retrieved directly from the official version-pinned API. Complete essential/optional counts are 24/84 (software), 63/34 (data science), 26/77 (web), 31/58 (AI) and 20/96 (database). There are 309 distinct linked concepts. All five roles have at least one reviewed learning-resource mapping; the initial eight-resource catalogue does not cover every missing concept.

Link checks establish transport availability only. Syllabus mappings, free-content access boundaries, prerequisites and published durations were reviewed separately; records preserve unknown durations. Exercises requiring accounts, course completion, regional sign-up availability and earned competency were not tested. All calculations are deterministic; no predictive accuracy or employment effect was measured.

Real trend ingestion/refresh, complete sourced SDG mappings and defined scenario effects remain team dependencies. Interfaces are implemented and tested; these external features are not claimed complete. No RunPod/cloud/model deployment, genuine CV handling, authenticated production environment or full final-round compliance is established by these tests.
