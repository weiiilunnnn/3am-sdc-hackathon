# SDC Hackathon Domain 1 — Features 3 & 4 Enhancement Request for Codex

**Status:** Follow-up implementation request for the **existing working prototype**, not a new project or replacement for the earlier handoff.  
**Date:** 2026-10-21  
**Target repository:** `3am-sdc-hackathon`  
**Frontend:** Existing Next.js + React under `src/frontend/`  
**Backend:** Existing FastAPI under `src/main.py`  
**Primary Python services:** `src/future_role_matching.py`, `src/personalized_reskilling.py`  
**Reference documents:** `SDC_Domain1_Features3_4_Codex_Plan_Handoff.md`, `SDC_Domain1_React_Frontend_Amendment.md`, Domain 1 PDF, current `README.md`, `docs/CONTRACTS.md`, `docs/SCORING_AND_LIMITATIONS.md`, `docs/VERIFICATION.md`.

## 0. Codex execution instructions

**First inspect the actual repository state** rather than assuming every filename/endpoint mentioned below still matches. Review the latest Git diff, existing frontend layout/components, backend endpoints, Pydantic/TypeScript contracts, ESCO subset preparation scripts, catalogue data, source validation, tests, and README. The previous implementation reportedly passed 39 backend and 6 browser tests; establish a fresh baseline before changes. Do not claim those tests pass now unless you run them.

This request **authorizes implementing the unambiguous changes** after the repository audit, keeping the original working app functional. For the **new scoring formula**, perform the data audit described in Section 2 first; if the required category mapping cannot be supported by reviewed data, do not make up skill categories or inflate scores. In that case, keep the existing method, implement the simpler score presentation improvements, and report the scored-alternative blocker with a concrete proposal for approval.

**Do not** rebuild the app, replace React/FastAPI, use Streamlit, make an LLM mandatory, overwrite teammates' feature implementations, remove provenance, or change the meaning of the existing score field silently. Make incremental, reviewable changes; run tests and report the results.

### Domain 1 rules that remain binding

- Feature 3: rank suitable future roles with an **explainable** matching score and skill-gap breakdown.
- Feature 4: provide an **ordered personalised reskilling pathway**, learning-time estimates and **free or low-cost** resources.
- Use only verified, sourced occupation records, skill requirements and courses. **No fabricated jobs, courses, URLs, statistics or supporting references.**
- Any LLM must be disclosed and not be the factual authority. No LLM is required in this change.
- Use only public/open/synthetic demo profile data; no real CVs or real personal data.
- Keep market-trend observations, personal fit, scenario assumptions and SDG mappings distinct; genuine trend, SDG and scenario integrations remain teammate-owned.
- Keep the source/date of genuinely observed market trends visible when eventually provided. Synthetic snapshots must never be mistaken for real market data.

## 1. User feedback and expected changes

1. Existing ESCO essential-concept coverage percentages (e.g., 3/26 = 11.54%) are often low; investigate and implement a **more meaningful, truthful score presentation and, if justified, an alternative matching calculation**. Keep existing exact concept coverage accessible.
2. Role cards and pathway views are **too text-heavy**; reduce default visible text, show fewer gaps, and use compact graphics, icons and progressive disclosure.
3. Only **five occupations** are candidates today. Expand the verified candidate catalogue where feasible, while still showing a compact top-5 result list.
4. The **Market Context** section is prominent despite containing only synthetic signals; make it compact and honestly labelled, and preserve its future role in Domain 1 Feature 2 integration.
5. Move the main **“What does the match score mean?”** explanation to the **bottom** of matching results.
6. Display that explanation as a **small, collapsed “About these recommendations” / “Scoring & limitations” disclosure**, similar in visual density to a terms-and-conditions link, without making crucial information inaccessible.
7. Make learning pathways more actionable and varied, including a recognisable **Online Courses** phase where verified courses genuinely support gaps.
8. Add **clearly labelled planning estimates** where providers do not publish durations: default **article = 1 planned study day**, **online course = 1 planned study week**. Preserve real published durations when available.

## 2. Feature 3 — Match-score redesign

### 2.1 What exists now (preserve for audit)

`essential_concept_coverage_pct = 100 * matched_essential_concepts / total_verified_essential_concepts`

This is evidence-grounded and reproducible, but it can be poor at expressing user-facing career alignment because ESCO occupations have differing numbers of granular essential skill **and knowledge** concepts. It is **not** employment probability. Current reports indicate every essential concept has equal weight; optional concepts, interests, proficiency, education and experience do not enter the score.

**Never merely multiply the result, reduce the denominator by omitting valid requirements, or label a score as probability of getting hired.** Scores do not need to be high; they need to mean what the UI says they mean.

### 2.2 Required data audit BEFORE adopting a different formula

Inspect the real ESCO import/subset and answer with code-backed evidence:

- Are essential relationships correctly imported and complete for each role? Are role requirements deduplicated by canonical ESCO URI, not by display label?
- Which concepts are classified as `skill/competence` versus `knowledge`? How many of each are essential per role?
- Are exact skill aliases already mapped, and do generic user terms unfairly miss related canonical concepts? Use **reviewed and documented** aliases; no unrestricted semantic-guess matching.
- Can source-backed ESCO skill hierarchies or a transparent, human-reviewed mapping group concepts into a manageable set of **competency domains**? Record which assignments are ESCO-derived and which are an application-defined heuristic. Every essential concept must stay accounted for, including an `Other documented requirements` domain when necessary.
- Compare current and proposed values for at least three distinct synthetic profiles and all candidate roles. Identify any serious anomalies before choosing a formula.

### 2.3 Preferred alternative, conditional on a defensible domain mapping

Introduce a **distinct** `competency_alignment_pct`, calculated from explicitly grouped required concepts rather than a plain all-concepts ratio.

For each mutually exclusive competency group `g` for a given occupation:

```
group_coverage[g] = matched_verified_essential_concepts_in_g
                    / total_verified_essential_concepts_in_g

competency_alignment_pct = 100 * mean(group_coverage[g] for all nonempty groups)
```

- Every essential concept must belong to **exactly one** group for scoring. Do not drop difficult/unrecognised requirements, and never treat having **one** concept in a group as complete mastery of the group.
- Equal weight across domains is **a chosen heuristic**, not a weight provided by ESCO. Disclose this and document the grouping algorithm/version, group counts and source/mapping provenance.
- A displayed score may go up, down or stay the same versus the original. **Do not optimize the formula to make percentages artificially higher.**
- Expose a simple domain-level breakdown (e.g. `Programming`, `Testing`, `Web standards`) only if the grouping is genuine and traceable. Never assert that those example names appear in a particular ESCO role until confirmed.
- Consider a separate *skill vs knowledge* breakdown from ESCO's documented `skillType` fields. Do not assign unsupported importance weights simply to improve the displayed number.
- If meaningful groups **cannot** be derived/verified: do not fabricate a new alignment score. Keep the strict ESCO coverage metric and improve its **label, presentation and explanatory context**. Report the unavailable grouping as a blocker requiring approval.

### 2.4 UX and contract for scores

**Card priority:** Show `Competency alignment` as the primary percentage **only when the alternative is fully implemented and documented**; otherwise show `Documented essential coverage` and numerator/denominator. Do not rename the old fraction to a new method.

For the existing response contract, **preserve** `personal_fit_score_pct` and its present meaning for backwards compatibility unless you deliberately version and migrate it with tests. Suggested *additive* new fields (adjust to existing schemas):

```json
{
  "score_method_version": "v2-domain-alignment",
  "essential_concept_coverage_pct": 11.54,
  "competency_alignment_pct": null,
  "display_score_kind": "essential_concept_coverage",
  "score_is_employment_probability": false,
  "competency_groups": [],
  "score_limitations": [
    "Scores use self-reported profile skills",
    "Market outlook is not part of personal skill alignment"
  ]
}
```

`competency_alignment_pct: null` is **correct until computed from valid data**. Update schema/docs/examples when implemented. The example 11.54% is illustrative, not a substitute for dynamic computation.

- Rankings must use a clearly specified score; if changed, preserve a configurable/visible basis and stable tie-breaking. Ensure all ranking fields, cards, and backend sorting use the *same* ranking basis.
- Show a short `Why this match?` popover/disclosure in each role card with only the top reasons and sources; put the full formula and limitations in the collapsed footer.
- Do not silently incorporate self-reported proficiency, interests or experience; these may appear separately as user-profile context until a defensible versioned method exists.
- No dynamic source claims or scores should be calculated in React; compute in Python and send validated structured JSON.

## 3. Feature 3 — React UI redesign (compact, visual, explainable)

### 3.1 Recommended hierarchy of the **collapsed** role card

1. **Top row:** concise verified occupation title, small icon, and small `ESCO`/source badge.
2. **Score row:** one prominent score OR numerator/denominator; a labelled thin progress bar. The bar needs text labels/accessibility and must not imply hiring probability.
3. **One-line** sourced role summary; truncate with `More` if needed.
4. **Strengths:** display **at most 3–5** top matched skills as chips, with `+N` for more.
5. **Priority gaps:** display **at most 3–5** learning-relevant missing items, with `+N more` for the rest. Rank priority by documented prerequisites and pathway usefulness or an explicit reviewed rule, never assume ESCO's original ordering represents importance.
6. **Compact market status**, when available (e.g. `Market data pending`, `Synthetic demo`, or a real dated sourced signal).
7. Main action: **`View learning pathway`**, plus compact `Why this match?` / source-link actions.

### 3.2 Expanded disclosure (optional)

- Show **grouped gap categories**, counts and small coverage/progress bars rather than printing dozens of individual skill rows by default.
- Full concept lists remain accessible under **`View all documented requirements`** with expandable groups, search/filter and scroll containment. Preserve exact ESCO IDs, essential/optional classification and per-relationship provenance.
- Default panel should not open all 26/50+ requirements or dozens of repeated `Requirement relationship source` links.
- Create a consolidated **source drawer/modal/disclosure** with clickable occupation and skill evidence; links must remain traceable to their claims.
- Keep optional vs essential skills identifiable. Do not hide unmatched/uncovered totals or misrepresent a subset as all requirements.

### 3.3 Results page

- Desktop: cards in a readable max-width layout, optionally 2-column if cards are genuinely concise; mobile: one column and adequate touch targets.
- Use icons, small horizontal bars, skill chips, concise labels and consistent whitespace. Avoid graphs that invent missing time series; if a graph is used, build it **only from genuine calculated structured data** (e.g. per-competency progress bars).
- **Move the global scoring explanation to the very bottom** after recommendation cards as a collapsed `<details>` or accessible React accordion labelled `About recommendations · Scoring and limitations` (terms-style presentation).
- Retain a **tiny nearby label** (`Skill alignment · not hiring probability`) and easy-to-open per-card explanation so moving the global explanation does not conceal what the percentage means.
- Preserve loading/error/empty states, profile-change cancellation, keyboard navigation, accessible contrast, source links and responsive layout.
- Avoid unrelated redesign of other teammates' pages.

## 4. Expand role coverage (while keeping the UI selective)

- The matching engine reportedly uses **five** ESCO technology occupations and always ranks from that fixed candidate set. Changing user skills changes order/scores but not the set itself.
- Review `scripts/prepare_esco_subset.py`, original downloaded ESCO package/version, licences and processing logic before expansion.
- **Target an initial verified shortlist of approximately 15–30 occupations**, if readily supported by available ESCO data and defensible for the product audience; treat this as a development target, not a licence to invent occupations. Document actual number achieved.
- Preserve original ESCO URIs, official titles, descriptions, complete essential/optional relationships and provenance; deduplicate by URI. Avoid hand-writing fictitious roles or incomplete partial requirement lists portrayed as complete.
- Display **top 5** matches initially, with `See more roles` / search/filter to explore the verified catalogue. Do not imply that all possible future jobs are covered.
- Recheck score comparability and runtime performance with more occupations; stable sorting and useful empty states.
- If downloading/preparing more records is blocked, keep existing five and record the reason rather than substituting fabricated data.

## 5. Market Context: compact, clearly scoped and future-compatible

### Current meaning

This is external **market demand/trend evidence**, distinct from **personal skill matching**. Current snapshot data is synthetic. No actual market growth/decline can be inferred from the available demo fixtures.

### Change

- Replace large `Market context` box/dropdown at the top with a **small collapsible `Market outlook` control** near the results header or compact per-role badges. Default to a quiet `No real market data yet` or `Demo market signals` state.
- If synthetic snapshots are selected, show `Synthetic demonstration — not real job-market evidence`, and keep all trend metrics/direction source status visible when expanded.
- If a future real trend snapshot is supplied, display signal direction, source, observation window, region and update date; do not imply Malaysia coverage if source is European/global.
- Never change the personal skill-match score in response to trend snapshots. In the future, a **separate** market-priority ranking may exist only after the teammate delivers comparable, sourced evidence and the rule is reviewed.
- Keep existing Feature 2 JSON contract/adapters and tests intact. Do not delete the market component; Domain 1 explicitly expects updateable trend signals and multiple scenarios elsewhere in the team app.

## 6. Feature 4 — Richer, less text-heavy reskilling pathway

### 6.1 UI goals

Replace the very tall documentation-style pathway with a **short summary plus visual roadmap**. At top show verified role, number of targeted skill gaps, reviewed resource count, estimated scheduling effort, and a compact warning if incomplete. Do **not** display `0 min` as a misleading end-to-end estimate when resources have unknown durations.

Suggested *conditional* phases (names are app-designed learning stages, not ESCO data):

1. `Foundations` — source-backed introductory reading and prerequisites.
2. `Guided Practice` — verified tutorials/documentation with relevant exercises.
3. `Online Courses` — verified free/low-cost provider-hosted courses that demonstrably address target gaps.
4. `Apply Your Skills` — optional clearly-labelled suggested practice/project tasks; these must not masquerade as sourced third-party courses, and time is an app estimate.
5. `Next Steps / Remaining Gaps` — uncovered requirements, advanced material, or further investigation needed.

**Do not force empty phases** or show repetitive filler. Order phases/resources with actual prerequisites; don't give a user duplicate resources. Phase composition must change with profile skills, verified gaps, study preferences and budget where supported. Keep `Online Courses` as a recognisable section *when relevant verified courses exist*.

### 6.2 Resource catalogue expansion

- Audit the current eight provider-linked materials and exact missing gap coverage.
- Add a meaningful range of **real, individually verified** resources relevant to the existing and newly included roles. Aim for **20+ reviewed resources**, if feasible, with several actual courses (not just articles). The exact count is secondary to correct gap coverage and provenance.
- Candidate provider classes include official documentation, Microsoft Learn, MDN, Google educational materials, freeCodeCamp and credible university open courses. **These are leads for verification, not automatically approved course records.**
- Each catalogue entry must provide: canonical URL, actual provider/title, content type, target verified skill IDs, evidence for the skill mapping, prerequisite information, access conditions, regional access caveats, cost/currency, duration when published, verification date and source ID.
- `HTTP 200` alone is not proof a page has the claimed course, that content is free, or that the skill mapping is accurate. Check provider content, claimed coverage and whether the linked material is genuinely an online course.
- No fabricated course titles, links, prices, published durations, certificates or promises of career readiness. No dependency on a paid AI API.
- If required skills still have no verified materials, clearly show the **number** and a compact expandable `Additional resources needed` section. Do not generate generic unsourced learning material to hide uncovered gaps.

### 6.3 Resource and phase cards

- Default each phase to a compact icon/number, short title, number of supported target gaps, resource count, and time label.
- Each resource: provider logo/icon only if approved asset is available (otherwise a generic icon), short resource title, `Article`/`Tutorial`/`Online course`, `Free`/confirmed price, estimate type, and an obvious link.
- Move long prerequisite lists, evidence IDs, disclaimers, full skill-concept mappings and source details behind `Details` / `Evidence` accordions; keep one short prerequisite warning visible when action-critical.
- Use a vertical stepper/timeline or progress-oriented phase cards, **not invented progress percentages** (only show completion if user can explicitly track it).
- Preserve mobile layout and accessibility.

## 7. Duration estimates: clearly distinguish provider facts from app assumptions

### 7.1 Requested fallback rules

When duration is **not published**, allow an *application-defined planning estimate*:

| Verified resource type | Fallback planning estimate | UI wording |
|---|---|---|
| Short article / reading | **1 planned study day** | `Est. 1 study day · app rule` |
| Online course | **1 planned study week** | `Est. 1 study week · app rule` |
| Short tutorial / documentation unit | **1 planned study day**, only if discrete and reviewed | `Est. 1 study day · app rule` |
| Large documentation collection / multipart programme | Require a reviewed scope-aware estimate or `Time unavailable` | Do not label an entire manual as a one-day article |
| Practical/project task | Explicitly reviewed project estimate or `Time unavailable` | `Practice estimate · app rule` |

**Priority order:** provider-published duration (with source) > reviewed app-specific scope estimate > simple fallback rule (only for eligible short units) > `unknown`. If published duration exists, do not overwrite it with the fallback heuristic.

Rules are for **planning**, not factual course duration or guaranteed skill mastery. Do not claim that a large course can truly be completed in one week without supporting evidence.

### 7.2 Interpreting 'day' and 'week' so totals work

To avoid mixing ambiguous units:

- Define **one planned study week = 5 planned study days** for the scheduling calculator (configurable, clearly explained as a convention).
- When the user supplies `hours_per_week`, show that input separately. For provider-published **hours**, convert to planned study weeks as `provider_hours / hours_per_week` if `hours_per_week > 0`, or to days using a documented `study_days_per_week` assumption.
- For fallback estimated articles/courses, sum their **planned study days**, then derive total planned weeks using **5 planned study days/week**. These fallback units are *not* provider-published hours and must not be silently mixed into a verified-hours subtotal.
- Prefer showing an **approximate planning timeline** such as `~2 weeks (app estimate)` plus `Known provider hours: 3 h` rather than a false precise `17 hours` if much of the schedule uses fallback units.
- When combining published-hour resources and fallback day/week units into one end-to-end schedule, define and test an explicit conversion using the user's weekly hours and study days/week. Keep an `estimate_confidence`/`estimate_basis` field and label the mixed result **estimated**, never source-published.
- If no usable study time preference is provided, fall back to a documented, visible demo assumption, or report that a calendar estimate is unavailable.
- Preserve full coverage flags independently from time coverage: a pathway with time estimates but many uncovered required skills is still **incomplete**. Never claim one course or one week makes a person job-ready.

### 7.3 Suggested versioned API metadata (adapt to existing models)

```json
{
  "time_estimate": {
    "value": 1,
    "unit": "study_week",
    "basis": "app_rule_of_thumb",
    "published_by_provider": false,
    "rule_id": "course_no_published_duration_v1",
    "notes": "Planning assumption, not a guarantee of course completion"
  },
  "coverage_complete": false,
  "timeline_is_estimated": true
}
```

Treat this as a **schema proposal**, not necessarily a new endpoint. Preserve compatible existing fields and introduce schema versioning/migration as needed. All new durations must be labelled either `provider_published`, `reviewed_app_estimate`, `app_rule_of_thumb`, or `unknown` (adapt names consistently).

## 8. Integration, proposed change locations and source controls

**Inspect before editing**; adjust paths to current project:

- Backend: `src/future_role_matching.py`, `src/personalized_reskilling.py`, `src/models.py`, `src/data_repository.py`, `src/main.py`, `src/trend_adapter.py` only if needed.
- Data preparation: `scripts/prepare_esco_subset.py`, `scripts/curate_learning_catalog.py`, verified catalogue/attribution files.
- Frontend: `src/frontend/components/CareerCard.tsx`, `PathwayView.tsx`, `SourceLinks.tsx`, `ScenarioNotice.tsx`, `src/frontend/app/page.tsx`, `src/frontend/app/globals.css`, relevant API/contracts modules.
- Tests: existing `tests/test_matching.py`, `test_reskilling.py`, `test_provenance.py`, `test_contracts.py`, `test_trend_integration.py`, `test_api.py`, frontend `e2e/workflow.spec.ts` and others as appropriate.
- Documentation: `README.md`, `docs/SCORING_AND_LIMITATIONS.md`, `docs/CONTRACTS.md`, `docs/DATA_SOURCES_AND_LICENSES.md`, `docs/DEMO_CHECKLIST.md`, `docs/VERIFICATION.md`.

Preserve original ESCO URI/source version, essential vs optional relationship provenance, verified resource URLs and learning-resource mapping evidence. Source and date disclosure must remain usable after UI compression (through drawers/accordions rather than dozens of inline repetitions). Ensure full traceability of each displayed claim.

## 9. Required test and verification matrix

1. **Data quality:** all occupation IDs, skill URIs and essential/optional relationships are traceable and not accidentally dropped; source mappings are valid; no duplicate concepts.
2. **Old score retained:** Web Developer sample computed from input still produces accurate strict concept coverage (3/26 = ~11.54% for that same profile/catalogue), regardless of new display choices.
3. **Alternative score correctness:** if implemented, group assignments cover all essential concepts exactly once; each group uses partial coverage, formula is documented, values stay 0–100, ranking uses the declared method, different profiles behave appropriately.
4. **Unsupported data:** missing/invalid requirements produce an unscorable result or documented fallback; no default perfect scores, hidden denominator reductions or made-up concepts.
5. **Role coverage:** verified expanded catalogue is loaded correctly; top five are from actual candidates, `See more` shows real roles, stable tie sorting holds.
6. **UI:** collapsed cards show at most 3–5 strengths and 3–5 priority gaps, no enormous concept list; expandable technical evidence and links remain accessible; compact footer score disclaimer appears below all results.
7. **Market context:** with no feed, show pending; with synthetic snapshot, label explicitly synthetic; with valid real observation, show source/window/date. Personal-fit scores never change when only market context changes.
8. **Pathway content:** selected role/profile changes gap-based phases; learning resources are real and match their claimed skills; prerequisite ordering and deduplication continue working; courses shown only when verified.
9. **Duration:** provider-stated hours take priority; article/course fallback only when eligible; fallback labelled app estimate; sums and hours/week conversions are tested; partial coverage remains incomplete; unknown/large resource scope remains honest.
10. **End-to-end:** form → five role cards → expanded card → pathway → evidence links works on desktop and mobile. No stale state after profile edits; no API errors; screenshots reviewed.
11. **Regression:** backend pytest suite, TypeScript checking, frontend production build and browser integration tests run and reported with accurate counts/results. Include any source-access limitations and verify no secrets committed.

### Final manual acceptance criteria

- [ ] Main results can be understood in approximately 5–10 seconds without reading technical evidence.
- [ ] Technical evidence is **available** but no longer overwhelms the default card.
- [ ] Score's meaning remains truthful and verifiable; alternative not introduced without justified grouping.
- [ ] Role recommendations are sourced and not restricted to five if verified expansion is feasible.
- [ ] Market panel is unobtrusive and explicitly synthetic/pending until real data arrives.
- [ ] Scoring/legal-style explanation is a small disclosure **at the bottom**.
- [ ] Learning pathway shows clear phases, genuinely verified courses and estimated planning time.
- [ ] Additional uncovered requirements remain disclosed without printing all of them by default.
- [ ] Existing frontend/backend and teammate integration contracts keep working.

## 10. Deliverable / reporting format for Codex

After implementing the approved changes:

1. Explain what the score used to mean, any new score's exact formula and limitations; show before/after **actual computed** results for at least 3 synthetic profiles.
2. List newly verified ESCO occupations and learning resources (counts, references, source/version and validation notes). State plainly if targets were not reached.
3. Provide screenshots of improved collapsed matching results, expanded source detail, pathway phases and timing label, including mobile if possible.
4. Enumerate changed files, API contract changes and compatibility risks for teammates.
5. Show actual test commands/results, build results, manual validations, and any unresolved issues.
6. Distinguish **real evidence**, **synthetic demonstration signals**, **provider-published durations**, and **app-defined estimates**.
7. Give exact Windows/VS Code commands for running the existing backend and frontend from repository root (verify against the current README).
8. Do not deploy, commit or change team-controlled files without permission if the repository conventions require approval.

**Implementation priority:** (P0) compact UI/footer and honest time-estimation metadata; (P1) verify and expand learning resources plus conditional learning phases; (P1) score-data audit and defensible improved score; (P2) verified occupation expansion; (P2) visual and mobile refinements. If one of these phases is blocked, continue with unrelated safe improvements and report the blocker.

---

## Official context / reference URLs

- ESCO classification and skills/knowledge distinction: https://esco.ec.europa.eu/en/classification
- ESCO downloadable data, current versions and formats: https://esco.ec.europa.eu/en/use-esco/download
- ESCO API and stable URI concepts: https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api
- Domain 1: use the repository's uploaded `Domain 1.pdf` and its actual six requirements/rules; **do not treat this file as a replacement** for that source.

**Precedence:** This document amends the **already implemented** Features 3–4 UI, scoring, catalogue breadth and pathway time estimates. It does not supersede the original evidence/LLM guardrails, teammate integration boundaries or Next.js/FastAPI architecture.
