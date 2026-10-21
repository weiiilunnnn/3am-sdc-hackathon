# Future-Role Matching implementation report - 21 October 2026

Implemented the approved Feature 3 changes in the existing Next.js/React + FastAPI application. Feature 4 engine, timing module, resource catalogue/source registry and PathwayView are byte-identical to the pre-change SHA256 baseline. No commit, deployment, new framework, paid dependency, LLM or real CV processing.

## Repository audit and before/after

| Item | Before | After |
|---|---|---|
| Matching universe | 15 curated ESCO v1.2.1 occupations / 485 concepts | 3,658 occupations / 14,579 concepts from the complete pinned official API collections |
| Relationships | Full links for the 15-role subset | 67,600 essential + 58,451 optional; no duplicate/orphan records or import anomalies |
| Default matching API/UI | v1 strict coverage, fixed candidate shortlist, top-five display | v2 dynamic reverse-index discovery, guarded relevance, variable qualified count and server pagination |
| Legacy compatibility | v1 personal_fit_score_pct is essential coverage | Existing v1 endpoint/field meanings preserved; v2 exposes the same strict fraction separately |
| Description | Preview span plus separate full paragraph | One clamped text element; Read more/Show less changes its state |
| Baseline tests executed | 50 backend / 9 browser passed | 70 backend / 10 browser passed; typecheck and production build passed |

No full CSV/ZIP package was present. The source was acquired through documented official bulk API methods, not an invented download URL or protected email flow. The supplied handoff was copied from Downloads into the requested docs path. Existing dirty work was preserved.

## Index, source provenance and offline operation

[Official API methods](https://ec.europa.eu/esco/api/doc/esco_api_doc.html) supplied the complete occupation and skill collections with selectedVersion=v1.2.1, English labels, active status, aliases and essential/optional edges. Bulk offset behaves as a page index in live probes despite inconsistent next-link arithmetic; the importer constructs bounded requests and checks unique counts against collection totals. All 15 original occupation relationship sets are checked as version anchors. Native URIs, source metadata and ESCO attribution are preserved.

The website documents API versions through v1.2.0, while executed probes accepted v1.2.1 and rejected v99.99.99. The server supplies no returned-version field; it stays null rather than being invented. Requested version, retrieval time, source URL and response hash are recorded for each page. A supplied incompatible returned-version value is rejected. Different-release lookups are informational and never update scoring records. See data/index/api-compatibility.json and the manifest.

Artifact: `data/index/esco_v1.2.1_en.json.gz` (7,952,736 bytes). SHA256: `1af1d8f54cecc44fb2535543a71bd583be9388eb855ce2f86b5424aca488a9c3`. Manifest: `data/index/esco_v1.2.1_en.json.manifest.json`. It records import version, counts, retrieval URLs/hashes, language, requested release, zero excluded inactive records and zero anomalies. Raw responses are an ignored `.cache/esco-bulk/` rebuild cache, not a runtime download.

Normal discovery performs no upstream requests. The local index is checksum/version/count validated and cached once per process. Official lookup/search are separate backend-only operations with a fixed official HTTPS base, canonical URI checks, bounded pages, timeouts/retries, redirect refusal and a bounded version-keyed cache. API errors are explicit; URI lookup can fall back to a matching-version local record. Search failures return an explicit unavailable status; normal discovery remains local.

If the full artifact is absent, corrupt or version-incompatible, the app labels the 15-role subset fallback. It never computes full-population IDF from that shortlist: uniform diagnostic weights are used and qualified recommendations are withheld because the informative-match guard cannot be established. Rebuilding the full index restores qualification. The fallback is honest but intentionally less functional.

## Algorithms and contracts

`profile-relevance-idf-v1`: weight(s) = 1 + ln((N+1)/(df(s)+1)); relation strength = 1 for essential, 0.4 for optional, 0 otherwise. Relevance = 100 * weighted overlap / total weight of all distinct recognised listed skills. N and df use the complete active indexed universe. Extra unrelated recognised skills can lower relevance; no proficiency, interest, education, experience, market or scenario weight is added.

Qualification requires raw relevance >= configurable 30%, at least two distinct matched canonical concepts, one essential match, complete evidence and an informative match with df/N <= 25%. Source-labelled transversal concepts cannot satisfy the informative guard. These are experimental application rules, not ESCO weights or readiness probabilities. One-skill, duplicate-alias, generic-only and unresolved profiles do not receive padded recommendations.

Sort: raw relevance descending, weighted essential evidence descending, matched distinct count descending, canonical occupation URI ascending. Display rounding never controls rank. Default page size is 5, maximum 25; title/official-alias filtering happens before pagination over qualified results. Response includes total and filtered counts, next offset, applied query, index/profile fingerprints and typed qualification diagnostics.

Primary cards have at most three matching strengths and five development areas. Areas group not-yet-evidenced essential concepts by an actual ESCO broader-skill edge, choosing one parent by label/URI for display only; remaining concepts use their actual sourced names with a grouping warning. All underlying concepts remain in the graph and strict denominator. Some areas can share a source concept across different mapping methods; React uses a composite identity. No domain-alignment score or invented semantic cluster is introduced.

New APIs: GET /api/v2/bootstrap (bounded seed data), GET /api/v2/skills (bounded search), POST /api/v2/matches, GET /api/v2/roles/detail (lazy full record), GET /api/esco/lookup and GET /api/esco/search. Discovery envelopes use 2.0; nested UserProfile and /api/pathways remain v1. The /api/* Next proxy is unchanged. Bootstrap/default-page measurements are about 112.5/63.2 KiB, not a dump of every occupation or requirement.

Feature 2 trend contracts/adapter and v1 behavior remain; only matching UI instances were removed. SDG/scenario metadata is accepted with existing source guards, without invented effects. Feature 4 compatibility is restricted to selecting the verified role directly instead of losing it behind the old top-100 cap, using the full canonical profile and lazily loading names/citations. No courses, phase logic, duration rules or resource choices were redesigned.

## Synthetic evaluation

All values are computed, not fixed recommendation expectations. Complete data and qualification reasons: docs/discovery-evaluation.json. Percentages have different meanings; a larger relevance value is not improved job readiness.

| Profile | Recognised | Qualifying roles | Status | Top actual result: relevance / strict coverage |
|---|---:|---:|---|---|
| demo-graduate-a | 5 | 11 | qualified | data scientist: 56.13% / 4.76% |
| demo-graduate-b | 5 | 27 | qualified | web developer: 75.22% / 11.54% |
| demo-graduate-c | 1 | 0 | insufficient_evidence | None |
| demo-discovery-data | 3 | 1 | qualified | computer vision engineer: 61.82% / 6.25% |
| demo-discovery-web | 4 | 13 | qualified | web designer: 82.95% / 30.00% |
| demo-discovery-business | 3 | 16 | qualified | financial manager: 100.00% / 7.89% |
| demo-discovery-generic-one | 1 | 0 | insufficient_evidence | None |
| demo-discovery-generic-two | 2 | 0 | insufficient_evidence | None |
| demo-discovery-specific-one | 1 | 0 | insufficient_evidence | None |
| demo-discovery-unknown | 0 | 0 | insufficient_evidence | None |
| demo-discovery-empty | 0 | 0 | insufficient_evidence | None |
| demo-discovery-mixed | 8 | 0 | no_qualifying_roles | None |
| demo-discovery-aliases | 1 | 0 | insufficient_evidence | None |

Examples on original overlapping roles: A/data scientist retains 3/63 = 4.76% strict coverage while profile relevance is 56.13%; B/web developer retains 3/26 = 11.54% while relevance is 75.22%. C/software developer previously showed 1/24 = 4.17%; the one-skill profile now has zero qualified recommendations. The legacy endpoint still exposes that old audit fraction.

Exact requested terms HTML, React, Excel and financial reporting were not resolved by unambiguous verified labels/aliases in this import. They remain visible unresolved inputs; the web/business fixtures additionally use valid native concepts selected by URI. Communication is ambiguous as a free-text alias; the synthetic generic fixture explicitly selects its native preferred-label record. No broad term was expanded into several skills. The eight-skill mixed fixture yields zero qualifiers because its unrelated recognised concepts dilute overlap; this is documented rather than lowering the threshold.

## Measured performance and tests

Recorded cold index load: 5236.757 ms. Engine medians over three runs per persona are in the JSON. The following are local in-process ASGI request medians, including validation/JSON serialization; they are not TCP latency or load-test guarantees:

| Profile | Median local ASGI ms | Response bytes |
|---|---:|---:|
| demo-graduate-a | 39.469 | 64712 |
| demo-graduate-b | 23.164 | 56806 |
| demo-graduate-c | 19.095 | 1568 |

Executed: `python -m unittest discover -s tests` (70 passed), `npm.cmd run typecheck` (passed), `npm.cmd run build` (passed), `npm.cmd run test:e2e` (10 passed). Targeted checks first: 9 scoring tests, 4 API-client tests, 7 full-index/API integration tests, then 3 browser wiring/toggle/mobile tests. The single full browser run exposed duplicate React keys for hierarchy/fallback areas sharing a URI; a composite rendering key fixed it, and a targeted pagination test passed with an assertion that no duplicate-key console error occurs. The full suites were not repeatedly rerun.

Backend checks cover full counts/foreign keys, strict-score compatibility, exact weighting, threshold boundary, generic/synonym guards, raw sorting/ties, source trust, pagination, unavailable/mismatched API, manifest fallback and a newly discovered role pathway. Browser checks cover real proxy/results, compact areas/source links, no market/full-requirement UI, one description element, variable counts/pagination/search, empty/unresolved/error recovery, cancellation, scenarios, mobile and new-role pathway handoff. No source access/enrolment or empirical prediction tests were claimed.

Screenshots captured and visually inspected: [desktop](screenshots/discovery-desktop.png), [evidence](screenshots/discovery-evidence.png), [mobile](screenshots/discovery-mobile.png), [new-role pathway](screenshots/discovery-pathway-handoff.png).

## Changed file map

| Files | Purpose |
|---|---|
| src/esco_api.py; src/occupation_index.py; scripts/build_esco_index.py; data/index/*; .gitignore | Official acquisition/client, validated full local index/cache and provenance |
| src/discovery_models.py; src/profile_relevance.py | Separate v2 compact contract, dynamic relevance, safeguards, grouping and pagination |
| src/models.py; src/skills_intake.py | Additive aliases/status/hierarchy/reuse metadata; exact spacing/case normalisation and cached alias lookup |
| src/main.py | v2 endpoints, safe explicit API lookups and minimal selected-role pathway compatibility |
| src/frontend/app/page.tsx; components/CareerCard.tsx; components/ProfileIntake.tsx; app/globals.css; lib/contracts.ts | v2 consumers, compact matching, description fix, removed market instances, bounded skill search |
| tests/test_discovery.py; test_discovery_integration.py; test_esco_api.py; src/frontend/e2e/workflow.spec.ts | Algorithm, evidence/client, compatibility and UI regressions |
| scripts/evaluate_discovery.py; data/demo/discovery_profiles.json; docs/discovery-evaluation.json; docs/future-role-baseline.json | Reproducible synthetic examples, timings and reskilling-preservation hashes |
| scripts/export_contract_schemas.py; docs/schemas/* | 11 refreshed v1 schemas plus 2 new v2 schemas |
| README.md; docs/CONTRACTS.md; SCORING_AND_LIMITATIONS.md; DATA_SOURCES_AND_LICENSES.md; VERIFICATION.md; this report; approved handoff copy; screenshots | Current setup, source/method limits and executed results |

## Remaining limitations / decisions

No blocking decision remains. The 30% threshold, 0.4 optional strength, 25% specificity guard and immediate-parent display rule are unvalidated product heuristics. Broader career potential and learning need are not inferred from omission. Full API collection coverage is established by upstream totals and unique records; CSV-package equivalence and an independently returned release label are not claimed. Real trend updates, complete SDG/scenario effects, assessed skills and production privacy/authentication remain outside this Feature 3 change. New roles often lack reviewed pathway resources, which remain incomplete without fabricated content.

## Run and rebuild (PowerShell, repository root)

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir src --reload --host 127.0.0.1 --port 8000
```

Separate terminal from repository root:

```powershell
Set-Location src/frontend
npm.cmd run dev
```

Open http://localhost:3000. API docs: http://127.0.0.1:8000/docs. Restart the backend to load updated local data. Existing requirements-dev.txt and npm lockfile are sufficient; no new dependency installation was introduced.

Explicit index rebuild/resume, never startup:

```powershell
.\.venv\Scripts\python.exe scripts/build_esco_index.py
.\.venv\Scripts\python.exe scripts/evaluate_discovery.py
.\.venv\Scripts\python.exe scripts/export_contract_schemas.py
```

For a deliberate fresh upstream acquisition, use a new `--cache-dir .cache/esco-review-YYYYMMDD` after reviewing the release/rights. The usual command resumes cached pages. ESCO_INDEX_PATH can select another compatible artifact. An outage leaves normal matching on the installed snapshot; a failed import is not a reason to fabricate or activate partial records.
