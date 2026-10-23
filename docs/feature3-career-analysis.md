# Career Details: ESCO evidence and optional Runpod interpretation

Career Overview, existing scores, search/pagination, navigation and Feature 4 are
unchanged. Below the overview are three full-width cards:

- Skill Gap Impact Analysis: the first four deterministic groups, with optional
  conditional AI interpretation and cited ESCO evidence.
- Transferable Skills Mapping: up to three AI-inferred learning bridges from
  recognised matched concepts to actual unevidenced groups. An inference is never
  an official ESCO skill relationship or proof of competence.
- Skill Evidence Matrix: Matched and Not Evidenced tabs, default Not Evidenced.
  Concepts, canonical URIs and essential/optional relationship types remain
  inspectable; four groups are initially visible; additional groups appear four at a time rather than being discarded.

## Architecture and API

`src/models/career_analysis.py` defines the additive contract.
`src/services/future_roles/career_analysis.py` prepares evidence and validates AI
output. `POST /api/v2/roles/analysis` accepts `role_id`, `recognised_skill_ids` and
`generate_ai` (default false). No names, profile identifiers, CVs or other personal
fields are accepted. Unknown IDs and extra fields are rejected.

The client first requests deterministic evidence with `generate_ai:false`, then
separately requests interpretations with `generate_ai:true`. The overview and
score are independent of either request. React rerenders and Strict Mode share
in-flight requests; obsolete responses cannot replace a changed role/profile.

Grouping reuses `profile_relevance.development_areas`: its existing defaults,
essential-only output and five-group limit remain unchanged for recommendation
and search clients. The analysis uses its additive full-output option, including
optional requirements. One stable verified broader parent is selected per concept;
otherwise the actual individual concept is displayed. Ordering remains distinct
concept count descending, then label and URI; it is not an importance ranking.
Every unevidenced distinct concept appears once. Group IDs hash the existing
mapping method plus concept URI because a parent and an individual fallback may
share a canonical URI. The original URI is preserved separately as `concept_uri`.

## Evidence, provider use and limits

The pinned local ESCO index remains the primary reference. Existing occupation,
skill, hierarchy and relationship provenance is reused; the dataset is not edited.
Its European classification does not establish local demand or hiring readiness.
Canonical `http://data.europa.eu/...` identifiers are preserved exactly, alongside
HTTPS identifiers, rather than silently rewritten. UI links accept only the
expected official ESCO hosts.

No external workplace/task facts are requested, so no Tavily search is necessary.
There are no courses, certifications, new skills, scores or impact tiers in the
AI output. All model prose is explicitly labelled conditional AI interpretation.
An existing citation supports only its source statements, not the inferred learning
connection. A factual workplace application is omitted rather than extrapolated.

One batched JSON call uses the existing `pathway_llm.invoke` request helper and
shared `runpod_api` transport, GLM-5.3, the team's default/override endpoint, low
temperature, 1,500-token cap and eight-second timeout. The Random Forest endpoint
and SDG implementation are untouched. It uses the existing backend-only `.env`
credentials. There is no request during listing or search.
The shared request helper now also treats an explicitly blank LLM endpoint
override as the existing team default, as required by the configuration contract.

The prompt contains at most five groups (six representative concepts each),
twenty matched concepts, concise ESCO evidence and a truncated occupation
description. The deterministic matrix retains the full requirement set. Output
validation checks role/group/skill membership, unique IDs, bridge source/target
evidence membership, verbatim supporting quotes, strict fields, lengths and
conditional prose. Unknown references, URLs in prose, numbers, scores and unrelated
credential fields cause a safe fallback. These conservative checks do not turn AI
inference into verified occupational facts.

Cache keys include canonical occupation, the full normalised recognised concept
set, all grouped gap IDs, ESCO/index version, prompt version and the evidence
fingerprint. Up to 64 results are cached in process for six hours; unavailable
results for 60 seconds. Up to sixteen distinct in-flight analyses are coalesced.
No profile/CV database or disk cache is added. Missing keys, timeout, malformed
JSON or invalid evidence keep the complete deterministic groups/matrix and an
empty bridge state. Restarting the backend clears the analysis cache.

## Changed files and verification

Backend: new models/service above; additive route in `src/api/future_roles.py`;
backward-compatible grouping options in `profile_relevance.py`.
Frontend: new `lib/career-analysis.ts` and `components/CareerAnalysisPanels.tsx`;
updated `CareerDetails.tsx` and scoped Future-Role CSS.
Tests: `test_career_analysis.py`, `frontend_components.test.ts`, new
`e2e/career-analysis.spec.ts`; route-count expectation updated in
`test_branch_integration.py` for the additive endpoint.

Automated tests use mocked Runpod and blank provider keys for real local HTTP
and browser checks. The browser checks cover desktop/mobile layout, both tabs,
keyboard interaction, source expanders, progressive analysis and unavailable AI.
They do not establish live model availability, latency or explanation quality.

Executed checks (22 October 2026):
- 13 Career Details backend/API tests, 6 role-search tests and 4 branch integration tests passed.
- 22 existing resource-discovery, 9 credential and 10 reskilling tests passed.
- 14 frontend component-rendering tests and TypeScript checking passed.
- 3 Chromium browser tests passed: desktop, mobile and missing-AI fallback.
- Isolated Webpack production build passed; temporary output was removed afterward.
- Desktop/mobile screenshots were inspected. No live Runpod or Tavily calls were made.

Live output quality and provider availability remain unverified. Conservative
validation can reject otherwise useful model text; the factual matrix and groups
remain available in that case. No credential changes or additional API keys are
needed to run Feature 3 with the existing backend configuration.


## Visual refinement — 23 October 2026

The approved reference and handoff are stored together in docs. The frontend uses
three stacked outer cards with four gap mini-cards, up to three skill bridge cards,
and four initial matrix tiles. Matrix expansion adds four items per click;
source disclosures mount on demand and reveal at most eight additional concepts
per click. Matched concepts use individual sourced tiles, without claiming a new
broader grouping. Desktop, tablet and mobile grids use four/two/one columns where
space permits (bridges: three/two/one). Native SVG icons are decorative only.

A single UI formatter preserves acronyms and existing brand casing; exact original
ESCO names and URIs remain in disclosures. Optional validated AI text is reused;
neutral source skill names are shown when interpretation is unavailable. The bridge
empty state distinguishes unavailable AI from no matched or no unevidenced concepts.
Definitions and limitations are consolidated under About This Analysis.

Backend grouping, canonical IDs, API and cache contracts, Runpod prompts/call counts,
matching and Feature 4 are unchanged. No speculative hierarchy roll-up was added.

Refinement files: `components/CareerAnalysisPanels.tsx`, new
`components/CareerAnalysisIcon.tsx`, new `lib/career-display.ts`, scoped Future-Role
`globals.css`, `tests/frontend_components.test.ts`, and `e2e/career-analysis.spec.ts`.
The approved handoff and reference PNG were copied to `docs/` when absent.

Focused verification: all 16 component checks passed across the initial run and
the corrected assertion rerun; 3 desktop/mobile/fallback browser tests passed.
The standalone TypeScript check and isolated Webpack production build passed.
Desktop/mobile screenshots were inspected. Temporary production output was removed.
Backend tests were not repeated because no backend code or grouping changed.
No live Runpod or Tavily calls were made; browser AI output was mocked.
