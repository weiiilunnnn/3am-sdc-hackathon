# Features 3 and 4 enhancement report - 21 October 2026

Implemented in the existing Next.js/React + FastAPI application. No deployment, commit, LLM dependency or replacement infrastructure. Existing uncommitted work was preserved. The supplied Downloads request was copied into `docs/SDC_Domain1_Features3_4_Enhancement_Request.md` because the requested repository path initially did not exist.

## What improved

- Matching cards show a concise source-backed summary, three starting strengths and three priority gaps, with totals for the rest. Bars have accessible labels. Requirements, exact IDs and per-relationship citations are searchable/filterable inside collapsed type/essential/optional groups. Sources are consolidated until a claim is inspected.
- Market outlook is a quiet disclosure and compact role badge. Synthetic fixtures remain explicitly synthetic; dates, windows, units, geography, direction and provenance are available on expansion. Personal scores and ranks remain independent of market signals. SDG/scenario integrations remain intact.
- The global explanation is a small, collapsed **About recommendations / Scoring and limitations** disclosure below the results. Self-reported / not-hiring-probability labels remain nearby.
- The reviewed candidate set grew **5 -> 15** occupations and **309 -> 485** unique linked concepts. Complete native ESCO requirements and provenance remain. Five results appear initially; See more and search expose the actual larger candidate set.
- Reviewed learning resources grew **8 -> 22**, including **ten course entries**: eight Google modules and two Harvard CS50 OpenCourseWare courses. [Exact titles, URLs, mappings and verification boundaries](CATALOGUE_REVIEW.md).
- Pathways now show a compact roadmap: Foundations, Guided Practice, Online Courses and Remaining Gaps only when appropriate. Adjacent stages of the same format combine while preserving prerequisite order. Resource links, format/cost and timing remain visible; detailed prerequisites, mappings and evidence use accordions. Uncovered gaps remain counted and expandable.
- A prerequisite-ordering defect exposed by the larger catalogue was fixed: previously selected prerequisites are still scheduled work, so their dependency edges must remain until ordering is complete. Shared resources still count once.
- Planning estimates now distinguish provider-published hours, reviewed app hours, app fallback study days and unknown time. A reviewed discrete short unit without published duration uses one planned study day; an eligible bounded course uses one planned study week. The default five-day convention is configurable in intake. Large manuals and CS50 programmes are not assigned misleading one-day/week totals.

## Score decision and actual examples

The old and adopted formula are the same: **100 x matched essential canonical concepts / all documented essential canonical concepts**. All requirements, including knowledge and unknown-type concepts, remain in the denominator. Exact fractions determine ranking, then canonical role ID breaks ties. The clearer displayed label is **Documented essential coverage**.

| Synthetic profile / same occupation | Before | After |
|---|---:|---:|
| A / AI engineer | 2/31 = 6.45% | 2/31 = 6.45% |
| B / web developer | 3/26 = 11.54% | 3/26 = 11.54% |
| C / software developer | 1/24 = 4.17% | 1/24 = 4.17% |

All 15 original profile-role pairs were checked for unchanged scores. All **45** expanded profile-role comparisons and skill/knowledge counts are in [SCORING_AUDIT.md](SCORING_AUDIT.md), generated from raw audits and the actual catalogue. New candidates can alter ranks: B now ranks ICT application developer (2/17 = 11.76%) before web developer, without changing the web fraction.

No competency-domain score was fabricated. The reviewed import has skill/knowledge types but no reviewed mutually exclusive competency-domain mapping or hierarchy graph. A diagnostic equal-type calculation was evaluated against all profiles/roles and rejected; treating an unknown type as an equal domain distorts results. `competency_alignment_pct` remains null; skill/knowledge counts are shown without new importance weights.

## Timing and evidence boundaries

The selected-material schedule is `(published hours + reviewed app hours) / user hours per week + fallback days / study days per week`. Subtotals stay separate. Unknown durations or unavailable conversion capacity make the combined selected-material schedule unavailable; known subtotals remain visible. `coverage_complete` is independent: a timed starter subset with uncovered requirements is still incomplete. Legacy complete `estimated_weeks` retains its original meaning.

For example, Profile A / data scientist now has **51** uncovered essentials, compared with the earlier starter route's 57. Its selected resources have **5 hours 40 minutes** of published estimates plus a large CS50 SQL course without a verified total-hour estimate. The application therefore keeps the whole selected-material timeline unavailable. This is partial learning support, not a 5h40m data-scientist training claim.

Real evidence: released ESCO v1.2.1 occupation records and reviewed provider pages. Synthetic evidence: three profiles and two demonstration trend snapshots. Provider facts: published Google/Microsoft duration estimates. App assumptions: reviewed mappings, shortlist selection, phase labels, priority-gap presentation and study-day/week conventions. No real market data, observed outcomes or assessed skills are implied.

## API and compatibility

See [CONTRACTS.md](CONTRACTS.md) and regenerated schemas. Existing endpoints, request structures and original field meanings remain; match/pathway responses emit additive **1.1** fields, with 1.0 requests still accepted. New fields cover score labels/breakdowns, candidate counts, priority-gap rules, phase kinds and planning metadata. `personal_fit_score_pct` and complete `estimated_weeks` have not been repurposed.

Teammates should accept supported 1.x minor versions, use canonical IDs, and avoid fixed candidate counts or phase titles. `dataset_id` is now `esco-tech-shortlist`; ESCO version and native IDs remain stable. Normalised profile fingerprints now include the default scheduling convention, so old fingerprints should be recomputed. Existing trend, SDG and scenario trust/adapter contracts remain intact. Restart FastAPI after catalogue updates.

## Files changed for this enhancement

| Area | Files |
|---|---|
| Backend | `src/models.py`, `future_role_matching.py`, `personalized_reskilling.py`, `main.py`; new `src/learning_time.py` |
| Frontend | `src/frontend/app/page.tsx`, `globals.css`; `components/CareerCard.tsx`, `PathwayView.tsx`, `ProfileIntake.tsx`; new `RequirementsExplorer.tsx`; `lib/contracts.ts`, `lib/api.ts` |
| Test isolation | `src/frontend/playwright.config.ts`, `next.config.ts`, generated Next additions in `tsconfig.json`, `.gitignore` |
| Preparation/audit | `scripts/prepare_esco_subset.py`, `curate_learning_catalog.py`; new `learning_additions.py`, `audit_scoring.py`, `report_catalogue_review.py` |
| Reference data | `data/occupations/esco_v1.2.1_en.json`; `data/resources/catalog_v1.json`; ESCO/learning source registries and verification logs; `link_check_log.json`; synthetic `data/demo/trend_a.json`, `trend_b.json` |
| Automated checks | `tests/test_matching.py`, `test_reskilling.py`, `test_provenance.py`, `test_api.py`; new `test_learning_time.py`; `src/frontend/e2e/workflow.spec.ts` |
| Documentation | `README.md`, `docs/CONTRACTS.md`, `SCORING_AND_LIMITATIONS.md`, `DATA_SOURCES_AND_LICENSES.md`, `DEMO_CHECKLIST.md`, `VERIFICATION.md`; new request copy, this report, `SCORING_AUDIT.md`, `CATALOGUE_REVIEW.md`, two scoring-audit JSON files; regenerated `docs/schemas/*.json` |
| Screenshots | `docs/screenshots/matches-desktop.png`, `matches-mobile.png`, `requirements-expanded.png`, `pathway-desktop.png`, `pathway-estimates.png`, `pathway-mobile.png` |

The wider Git working tree already contained the prior implementation changes; the table identifies this enhancement's changes rather than attributing every existing dirty file to this request. Dependencies, RunPod skeleton, legacy helpers and unrelated teammate pages were not rebuilt.

## Verification and screenshots

Actual commands, baseline/final counts and environmental failures are recorded in [VERIFICATION.md](VERIFICATION.md). The backend uses its existing **unittest** runner, not an unconfigured pytest command. Browser tests exercise the real API through the existing proxy on isolated test ports 8100/3100. Type checking and the production build are separate checks.

- [Collapsed desktop matching](screenshots/matches-desktop.png)
- [Mobile matching](screenshots/matches-mobile.png)
- [Expanded requirement evidence](screenshots/requirements-expanded.png)
- [Desktop pathway](screenshots/pathway-desktop.png)
- [Fallback labels and resource evidence](screenshots/pathway-estimates.png)
- [Mobile pathway](screenshots/pathway-mobile.png)

## Remaining work and decision

The expansion targets were reached (15 occupations, 22 resources). Learning coverage is still partial; some added roles have no mapped resources, and large unestimated courses retain unknown time. Public content access was checked; accounts, submissions, paid credentials, regional enrolment and learning completion were not tested. No unsourced project tasks were inserted to fill gaps.

Real trend ingestion, complete SDG mappings and defined numerical uncertainty scenarios remain teammate-owned. There is no production deployment, real CV intake, hiring prediction or competency assessment.

The only score-method decision is whether to undertake a reviewed domain-mapping stage before adopting a second score. Concrete proposal: retrieve the matching-version ESCO broader-skill graph, review mutually exclusive assignments for every essential URI, define multiple-parent/fallback handling, retain Other documented requirements, and review exact rank changes before approving equal-domain weights. Until then the requested honest strict-coverage fallback is active; no decision is needed to run this implementation.

## Run locally from repository root (PowerShell / VS Code)

One-time setup, if dependencies are not installed:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Push-Location src/frontend
npm.cmd ci
npx.cmd playwright install chromium
Pop-Location
```

Terminal 1:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir src --reload --host 127.0.0.1 --port 8000
```

Terminal 2, also starting at repository root:

```powershell
Set-Location src/frontend
npm.cmd run dev
```

Open http://localhost:3000; API documentation: http://127.0.0.1:8000/docs. The existing proxy forwards `/api/*`. Reusing an existing backend process requires restart to reload reviewed data. No paid API or model credentials are required.
