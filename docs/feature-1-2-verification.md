# Features 1–2 completion and verification

Verified on 2026-10-21, branch `SH`. **VERIFIED** means observed in an executed check; **PARTIAL** means usable with stated coverage/verification limits; **BLOCKED** means a dependency prevents completion; **NOT IMPLEMENTED** means no implementation is claimed.

## 1. Feature 1 changes — VERIFIED

- Fixed character-by-character comma-list editing: raw text retains separators while the submitted lists are trimmed/deduplicated.
- Fixed transient saved-profile retrieval failures: retain the device's saved ID, show prominent loading/error feedback and a retry, and disable saving while recovery is unresolved. A confirmed 404 clears the stale reference.
- Keep the returned profile and ID if the server save succeeds but browser storage fails; report that separately from an API-save failure.
- Match backend list-item validation to the frontend limit: nonblank entries, at most 120 characters each.
- Corrected an outdated taxonomy module comment: all current skill identifiers are local prototype terms, not ESCO URIs.

## 2. Feature 1 end-to-end results — VERIFIED

The initial real-browser pass:

1. Loaded the computer-science synthetic sample.
2. Added a fictional custom skill and changed Python proficiency.
3. Observed **POST 201**, a structured stored profile and server-generated ID.
4. Reloaded and observed **GET 200** with the same ID and changes.
5. Edited aspiration/proficiency, observed **PUT 200**, then reloaded and confirmed persistence.
6. Confirmed required-field/fictional-confirmation validation prevented invalid submission.
7. Found the comma-separator defect and loss of the saved ID after a simulated GET 503.

After fixes, the focused browser regression pass verified:

- A delayed GET displayed the prominent loading message; a simulated 503 retained the ID, displayed retry feedback and disabled Save.
- Removing the failure and clicking Retry retrieved the same profile with **GET 200**.
- Sequential typing preserved `AI, climate` and `Data storytelling, peer tutoring`; **PUT 200** request/response JSON contained separate entries, and reload preserved them.
- A delayed PUT displayed “Saving profile…” with a disabled button. A simulated **503** retained the draft and saved ID. A subsequent retry returned **PUT 200** and a success message.

Profile operations used a temporary SQLite database and an isolated FastAPI process on port 18973. The temporary server was stopped afterward. The initial setup briefly sent only sample/vocabulary GETs to an already occupied port 18080 before correction; no profile write or saved-profile read went there. A brief test-server startup refusal in the regression pass cleared after a successful health check. Final developer-database profile count remained **0**.

This was automated browser execution during the session, not a committed, locally runnable Playwright suite.

## 3. Selected source and permitted use — VERIFIED, conditional permission

**Remote OK**, public JSON feed at `https://remoteok.com/api`.

The official [FAQ](https://remoteok.com/faq#feeds-sponsorship) permits public-feed use by aggregators/sharing with credit and original posting links. The [legal terms](https://remoteok.com/legal) and feed metadata require attribution/links; the feed asks for followed links and no logo without permission. The UI provides Remote OK credit and normal followed original links, uses no logo and adds no signup gate.

This is conditional API permission, **not a claimed open-data licence** or a guarantee that terms never change. See [the candidate comparison and collection policy](employment-source.md) for Remote OK, Adzuna, Arbeitnow and Remotive.

## 4. Actual coverage, dates and sample — VERIFIED

One unfiltered collection was successfully performed through `POST /api/employment/refresh`:

| Observation | Actual result |
| --- | --- |
| Collected / last successful refresh | `2026-10-21T05:33:59Z` |
| Provider feed-updated metadata | `2026-10-21T00:00:06Z` |
| Received posting records | **99** (metadata object excluded) |
| Retained unique validated records | **99**, configured limit 100 |
| Excluded records in this collection | **0** |
| Distinct case-insensitive employer names | **92**, not verified corporate entities |
| Publication range | `2026-08-11T08:00:43Z`–`2026-10-19T16:00:04Z` |
| Missing location | **48** postings |
| Distinct nonempty provider location labels | **38**, not standardized countries |

Examples of provider location labels include Brazil, Copenhagen and Bishkek, alongside remote/international eligibility strings. Some source strings contain encoding artifacts; they are not silently repaired or converted into inferred countries.

Example genuine records:

- [Customer Support Consultant hospitality — SupportYourApp](https://remoteOK.com/remote-jobs/remote-customer-support-consultant-hospitality-supportyourapp-1137547), published `2026-10-19T16:00:04Z`.
- [Senior Backend Engineer — Rain](https://remoteOK.com/remote-jobs/remote-senior-backend-engineer-rain-1137544), published `2026-10-18T18:00:01Z`.

Configured mentions included Python in **12/99 (12.12%)** and machine learning in **7/99 (7.07%)**. Exact topic-rule matches were LLMs 7, AI agents 10, RAG 0, computer vision 0 and responsible AI 2. These are overlapping keyword counts in this sample, **not market demand, confirmed requirements or evidence of zero demand**.

A separate tagged-feed request was inspected during source research; it was not merged into this cached sample. No live OpenAlex refresh was performed.

## 5. Feature 2 changes — VERIFIED at bounded prototype scope

- Independent employment provider contract, Remote OK HTTP adapter, schemas, service and API.
- Bounded response/sample validation, ID/URL deduplication, HTML-to-text handling and exact keyword evidence. No raw descriptions are persisted or rendered.
- Atomic snapshot persistence with source configuration, original IDs/URLs/dates, normalized publication/retrieval times, feed metadata and collection counts.
- Cache-only GETs; explicit refresh with a 24-hour attempt cooldown. Failure preserves the previous snapshot and last success. No synthetic substitution.
- Separate employment panel with source/terms links, dates, coverage, limitations, count/share table, exact-ID profile overlap, topic/skill filtering and a bounded show-more list.
- Research topic selection also applies to the separate synthetic demo. Existing research aggregation, missing-year behavior and refresh remain intact.
- Responsive filter stacking, scrollable data table, labelled controls, native evidence details and visible loading/retry/error/empty states.

The developer's **25 OpenAlex observations** remained unchanged, including a before/after content-digest comparison. The employment snapshot uses independent tables.

## 6. Files added or modified

Backend:

- `src/main.py`
- `src/api/employment.py`
- `src/models/employment.py`, `src/models/profiles.py`
- `src/data/employment_source.py`, `src/data/skills_taxonomy.py`
- `src/services/employment_service.py`, `src/services/storage.py`
- `src/services/sources/employment_base.py`, `src/services/sources/remoteok.py`

Frontend:

- `src/frontend/app/page.tsx`
- `src/frontend/app/radar/page.tsx`
- `src/frontend/app/radar/EmploymentSnapshot.tsx`
- `src/frontend/app/globals.css`
- `src/frontend/lib/api.ts`, `src/frontend/lib/profile-validation.ts`
- `src/frontend/package.json`, `pnpm-lock.yaml` — only `tsx` added as a frontend development dependency; no new runtime package.

Tests:

- `tests/test_api.py`, `tests/test_employment.py`, `tests/test_openalex_http.py`
- `tests/frontend_components.test.ts`

Documentation:

- `replit.md`, `docs/architecture.md`, `docs/features-1-2.md`, `docs/testing.md`
- `docs/employment-source.md`, this report.

## 7. Checks executed and exact outcomes

| Check | Final outcome |
| --- | --- |
| `PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -p 'test_*.py' -v` | **38 passed**, 0 failed |
| `pnpm --filter 3am-sdc-frontend run test:logic` | **5 passed**, 0 failed; existing Node module-type warning only |
| `pnpm --filter 3am-sdc-frontend run test:components` | **6 passed**, 0 failed |
| `pnpm --filter 3am-sdc-frontend run typecheck` | **Passed**, 0 errors after correcting a callback type annotation |
| `pnpm --filter 3am-sdc-frontend run build` | **Passed**, Next.js 16.4.2 optimized build generated `/` and `/radar` |
| Browser profile journey | Initial pass found two defects; targeted post-fix pass **passed** |
| Live proxied `/api/health`, `/api/healthz` | **200**, status `ok` |
| Live employment collection | **200**, refresh status `success`, genuine sample above |
| `git diff --check` | **Passed**, no whitespace errors |

Python coverage includes in-process ASGI create/read/update/validation/missing-record behavior, health/legacy summary, cached routes that must not use network, both refresh routes, profile relevance and cache preservation. Mocked HTTP tests cover valid responses, malformed JSON and network/provider failures. Employment tests also cover deduplication, dates, source URL restrictions, sample caps, null IDs, keyword boundaries and cooldown.

Component tests render actual React components: privacy/loading, attribution and escaped text, empty/error/cache states, initial topic/skill filters, exact-ID overlap and cooldown. They are rendering assertions, not hydration/click tests.

The web/API managed workflows were restarted and served successfully. Desktop full-page and 390px radar screenshots were inspected; fresh captures showed only development/HMR messages, not runtime errors. Earlier pooled logs contained transient HMR/RSC-navigation errors during active edits. Mobile employment interactions, every device and a full accessibility audit were **not** separately automated.

## 8. Remaining limitations — PARTIAL

- One remote board is not representative international hiring data; many records lack locations, tags can be noisy and listings may be stale. No confirmed live-vacancy status.
- Exact phrase rules are limited and can misclassify context. They do not extract all skills, understand negation, verify requirements or imply learner proficiency.
- No comparable employment history or employment-growth calculation. OpenAlex remains a research proxy; its configured search text is not a controlled occupation taxonomy.
- Small local skill vocabulary, not verified ESCO coverage. Existing learning-budget storage remains MYR; international currency support was not added.
- SQLite/development-device recovery is not proof of production persistence. No production routing, security or durability certification was performed.
- Browser-storage-denial handling and the new 404 recovery branch were reviewed; the browser regression specifically exercised transient GET/PUT failures, not every browser storage policy.
- Browser session automation is not a committed repeatable CI E2E suite. Component tests do not replace interaction/accessibility testing.

## 9. Judging requirement compliance — PARTIAL overall

| Compulsory capability | Status |
| --- | --- |
| 1. Skills Profile Intake | **VERIFIED** synthetic prototype workflow, validation, normalization and persistence |
| 2. AI-Trend Signal Layer | **VERIFIED** research cache plus attributed employment snapshot; **PARTIAL** breadth/market coverage |
| 3. Explainable Future-Role Matching | **NOT IMPLEMENTED** |
| 4. Personalised Reskilling Pathway | **NOT IMPLEMENTED** |
| 5. SDG Mapping | **NOT IMPLEMENTED** |
| 6. Multiple future scenarios | **NOT IMPLEMENTED** |

The known six-capability brief is not yet fully satisfied; formal judging acceptance cannot be certified. No critical external dependency is currently **BLOCKED** for the work delivered here.

## 10. Ready for Feature 3?

**Yes, for the next prototype development phase**, using the verified profile contract and clearly separated evidence layers. Feature 3 still needs its own role-catalogue, matching and explanation design; keyword overlap must not be presented as a role recommendation.

Next.js + FastAPI + SQLite and the `src/` organization were preserved. No real CVs, paid service, RunPod, model training, framework migration, backup deletion, deployment/publication, commit, merge or push was performed. Changes remain uncommitted on `SH`; local SQLite and `.next` output are ignored, and no paths are staged.
