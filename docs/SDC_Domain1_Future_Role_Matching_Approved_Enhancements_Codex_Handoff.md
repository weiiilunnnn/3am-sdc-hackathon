# SDC Hackathon Domain 1 — Future-Role Matching Enhancements

**Codex implementation handoff — APPROVED change request**  
**Date:** 21 October 2026  
**Project:** 3AM SDC Hackathon — Aiversecity Future-Ready Workforce  
**Scope:** **Feature 3, Future-Role Matching, only**  
**Stack:** Existing **Next.js + React** (`src/frontend/`) and **FastAPI/Python** (`src/main.py`)  
**Status:** Decisions approved by project owner. **This document authorises implementation** after inspecting the current repository; it is not a request to design a new project.

> **Read this first.** This document supersedes older handoffs **where they conflict on Future-Role Matching behaviour** (number of occupations, discovery, score semantics, Market Outlook UI, skill-gap UI, description expansion). All other established safeguards, source requirements, team integration contracts, and the personalised reskilling functionality remain in effect. The previous handoff and React amendment remain useful context, but **do not rebuild the app**.

## 0. Instructions to Codex: execute this approved change, not a fresh proposal

1. Inspect the **actual, current** repository and recent diff. The implementation might now support **15 roles** (earlier reports mentioned five); do not assume a fixed number from earlier conversations. Find the real files, data stores, endpoints, TypeScript types, tests and current UI.
2. Read available project documentation (`README.md`, `docs/CONTRACTS.md`, `docs/SCORING_AND_LIMITATIONS.md`, `docs/VERIFICATION.md`, `docs/DATA_SOURCES_AND_LICENSES.md`) and the original Domain 1 brief if present. Run existing relevant tests to establish a baseline and report any pre-existing failures.
3. Identify dependencies on **Feature 4 Reskilling**, **Feature 2 Trend Signals**, **Feature 5 SDG Mapping**, **Feature 6 Uncertainty**, and the current temporary intake. Define backwards-compatible adapters **before** modifying contracts.
4. Implement the approved changes incrementally; run backend tests, frontend tests/type checking, and browser tests as appropriate. Continue through all unambiguous changes without seeking another general approval.
5. **Escalate only genuine blockers** that would force unsupported factual claims, violate source/format compatibility, require unavailable manual ESCO downloads, or change another teammate's implementation. Report any documented fallback honestly.
6. Do not fabricate occupations, skill links, market outlooks, citations, AI-derived competencies, sample results, provider data, or test results. Do not commit, deploy, or remove unrelated features without explicit authorisation.
7. At completion, provide an exact file map, changed algorithms/contracts, provenance/data versions, execution commands, tests actually run, before/after examples on synthetic profiles, remaining issues and limitations.

**Explicitly out of scope:** redesigning the personalised reskilling engine, building new learning phases or courses, adding an LLM/chatbot, real CV processing, replacing the team's trend service, fully implementing SDG/scenarios, changing the full app stack, or fixing unrelated files. Only the minimal compatibility adaptations may be made beyond Feature 3, and they must be identified in the final report.

---

## 1. Authoritative requirements and rationale

### 1.1 Domain 1 requirements to preserve

From *Domain 1 — Aiversecity Future-Ready Workforce*, pages 4–6:

- Feature 3: **rank suitable future roles with an explainable match score and a clear skills-gap breakdown**.
- Feature 2: the **overall product** must use at least one **updatable AI/job-market trend source**, showing source and date; hard-coded lists alone do not count. Feature 2 belongs to the teammate, but Feature 3 should not break integration.
- Feature 4: personalised ordered learning pathway remains functional when a role is selected, even if its resource coverage is incomplete.
- Feature 5: role and skill IDs must remain available for source-backed SDG mapping.
- Feature 6: scenario metadata/inputs must stay compatible; don't manufacture scenario effects.
- Use public/open/synthetic data for the demo. **Do not use real personal data or real CVs**; use synthetic profiles.
- All recommendations must be supported by citations. The system must not invent jobs, courses, skill requirements or statistics. If an LLM is eventually used, disclose its exact model; **no LLM required** in this enhancement.
- AI supports human career decisions; it is not a hiring decision-maker.

### 1.2 Approved user-facing changes

1. **Search broadly** across the ESCO occupation classification instead of considering the same 15 preselected roles for everyone.
2. Build a **hybrid ESCO data architecture**: full locally indexed occupation–skill records for fast discovery; an **official ESCO Web-Service API adapter** for live record lookup/verification/updates where supported, with caching and offline fallback.
3. Replace the previous *only* user-facing `matched essential concepts / total essential concepts` ranking with an **explicitly defined profile-relevance** method that does not punish short CVs by calling every unmentioned concept a confirmed deficiency. Keep strict essential-concept coverage as a separate audit metric.
4. Start with a **configurable 30% profile-relevance qualification threshold**, protected by meaningful-match/evidence safeguards. Do **not** label 30% as ESCO-endorsed or as job readiness.
5. Return a **variable number of qualifying careers**, potentially zero, rather than always showing 15 or always forcing five results. Paginate or progressively disclose if many qualify.
6. Remove the **Market Outlook** / unknown/synthetic market display from the **Feature 3** results UI. Preserve backend trend contracts and teammate-owned Feature 2 functionality.
7. Replace **View All Documented Requirements** and dozens of concept text rows with **3–5 compact, traceable competency/development areas** per role. Preserve all source relationships behind the API for calculation and audit.
8. Fix the **Read more / Show less** bug: a truncated role description must be **replaced**, not duplicated, upon expansion.
9. Do not modify Feature 4's recommendation/resource selection logic; ensure selected new roles still have safe handoff behaviour and honest 'incomplete resource coverage' messaging.

**Important vocabulary:**

- **Profile relevance** = how much of the user's **verified/recognised listed skills** are relevant to the occupation, with transparent weights. It is used for discovery and ranking. **Not** readiness/employability probability.
- **Documented essential coverage** = how much of an occupation's essential ESCO requirements is **evidenced by the user's profile**. It is a distinct audit number. **Not** a factual list of skills they do not have.
- **Development areas / to verify** = source-backed essential competencies **not evidenced by the profile**, **not** confirmed deficiencies or assumed training needs.

---

## 2. Baseline audit — mandatory before editing

Codex must inspect, not infer:

- Actual role count, ESCO version, source types, schemas, data sizes, refresh and build scripts; check if the current import is a local subset and whether full raw ESCO files are available.
- Actual matching equation, essential/optional treatment, aliases, duplicate concept handling, sorting/tie-breaking and API output.
- Actual source-validation rules and citation identifiers; ensure expanded occupations preserve equivalent evidence standards.
- Existing React components (`CareerCard`, main page, `SourceLinks`, `ProfileIntake`, etc.) and whether the description bug is caused by separately rendered preview/full-description elements.
- Whether Next.js `/api/*` proxies to FastAPI and how the frontend consumes result fields.
- How Feature 4 currently requests pathways and how it handles a role with **no mapped learning resource**.
- Existing integration contracts for trends, SDG and scenarios; document which schema changes would be additive/breaking.
- Baseline test counts: do **not** assume previously reported '39 backend and 6 browser tests' still pass.

**Audit deliverable in final report:** a small before/after table with measured occupation counts, data versions, prior/result response fields, baseline/final test results and the observed role-description bug cause.

---

## 3. ESCO data discovery: full coverage with a hybrid architecture

### 3.1 Official sources (use these, not unofficial similarly named third-party APIs)

- Official ESCO downloadable dataset: <https://esco.ec.europa.eu/en/use-esco/download>
- Official ESCO APIs: <https://esco.ec.europa.eu/en/use-esco/use-esco-services-api>
- Official ESCO Web-Service API: <https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api>
- API endpoint/method reference: <https://ec.europa.eu/esco/api/doc/esco_api_doc.html>

As of the source review on **2026-10-21**, the official website identifies **ESCO v1.2.1** as the current classification dataset, while the official **Web-Service API page lists v1.2.0 as its latest available API version** and states that the API defaults to an older version. **Codex must verify live support before choosing `selectedVersion`. Never silently compare or merge v1.2.1 local data with v1.2.0 API relationships.** If version parity is unavailable, use **v1.2.1 local data as the authoritative matching basis**, and treat API responses as separate-version informational lookups or disable them when they would corrupt scoring.

Official dataset download is a package-selection flow that may require the organiser/developer to accept a privacy notice and supply an email to obtain a link. Do **not** invent a machine-download URL, scrape a protected interaction, or assume fully unattended download is available. Provide an exact manual download/setup path and import instructions when needed.

### 3.2 Preferred local index for search and scoring

Build an index over the **full verified ESCO occupation and skill/knowledge relationship set**, not a manually selected shortlist:

- Occupation URI, preferred label, description, aliases/alternative labels, language, release version, source reference, obsolescence status.
- Canonical skill/knowledge URI, preferred label, aliases, skill type, source metadata.
- Occupation–skill edges including **essential versus optional** relationship, evidence/source identity and release version.
- Optional hierarchy/grouping metadata only when actually available and verified.
- Reverse lookup `skill_uri -> [(occupation_uri, relation_type), ...]` for efficient dynamic candidate discovery.

Use source-provided stable URIs as primary identities; deduplicate by canonical URI, **not display name**. Preserve essential and optional as distinct edges. Do not discard relationships to make scores higher. Validate that imports have no orphan references, duplicate edges or obsolete-only target occupations.

**Storage choice:** inspect existing implementation; use compact local structured files, SQLite or another existing dependency-compatible storage layer, depending on dataset size and query performance. Do not assume an enterprise database is necessary. Full-dataset ingestion/index construction should occur **offline or on explicit refresh**, not on every user request.

**Dataset artifact and reproducibility:** record source page/URL, download date, package version, language, license/attribution terms, checksum, import script version, occupation count, distinct concept count, and essential/optional edge counts. Do not commit gigantic or license-incompatible artifacts without checking repo policy. Preserve a small, sourced built-in subset as an explicitly limited fallback for offline demo operation.

### 3.3 Official API adapter

Implement an isolated backend client (adapt file names to repository conventions) that supports verified official methods needed for:

- Fetching/searching occupation and skill concepts by keyword/URI.
- Looking up relevant relationships and canonical identifiers where the API supports them.
- Targeted record refresh/verification and source links, with explicit version selection.

**Do not assume** an API endpoint exists that takes a list of user skills and returns occupations with a 30% score. ESCO does not calculate our application-defined relevance score; **our backend must calculate it**.

Requirements for this adapter:

- Only backend contacts the upstream API; React calls FastAPI via the existing proxy.
- Controlled official allowlisted host/base URL, safe URL construction, bounded request sizes, finite timeouts, bounded retry/backoff, cache and clear errors.
- Record `requested_version`, `returned_version` where available, language, retrieval date, source URI, and evidence provenance. Detect incompatibilities.
- Protect normal matching requests from API outages; use pinned **matching-version** local catalogue when the API is inaccessible or mismatched. Display honest `data_source_status` metadata (e.g. `local_full`, `local_subset_fallback`, `api_checked`, `api_unavailable`), not false 'live' claims.
- Prefer batch or build-time API queries; no N+1 upstream requests for hundreds of candidate occupations on each form submission.
- No invented rate-limit guarantees, no third-party `getesco.com` substitution, no API keys in code or repository.

### 3.4 Coverage and refresh behaviour

- **Full classification searchable** means any occupation in the imported, compatible ESCO release may become a candidate if linked to a recognised user skill.
- A user's role list must be **computed dynamically**, not selected from a static 15-role list.
- It is acceptable to keep a curated set of occupations as **demo fallback** only when full ingestion/API is unavailable, but clearly label its limited coverage; never claim full ESCO discovery while in subset fallback mode.
- Refresh must be explicit or scheduled by another component, reproducible, version pinned and testable. Cache invalidation must be based on data version/source update, not arbitrary trust in a fresh network response.
- Preserve evidence and provenance through all processing, not only at the raw import stage.

---

## 4. Profile preprocessing and truthful unknown-skill handling

Input remains the established versioned `UserProfile` contract; extend only if required and backwards-compatible.

- Accept **synthetic** intake profiles/form skills; integration with teammate CV parser is a future contract input, not part of this feature change.
- Resolve exact canonical URI, preferred label and reviewed aliases; normalise case/spacing and deduplicate canonical IDs.
- Do **not** silently convert broad terms (e.g. "programming") into dozens of specific ESCO concepts. No uncontrolled LLM-inferred mappings or assumed proficiency.
- Keep unresolved terms visible for user correction; don't fabricate sources/relationships to increase matches.
- Record `recognised_user_skill_count`, `unknown_user_skills`, `alias_mapping_confidence`/method where appropriate, and evidence that a concept is in the catalogue.
- Explicitly avoid treating CV omission as proof of absence. Every unknown role requirement is **not evidenced** unless the user confirms otherwise.
- A user with no recognised skills: do not assign scores or return a padded recommendation list. Explain how to add/clarify skills.
- A profile with only one recognised generic skill: avoid confident recommendations; show a low-evidence prompt asking for more information.
- Preserve profile fields such as interest/proficiency/experience but **do not silently add them** to scoring until a separate justified decision is approved.

---

## 5. New dynamic candidate discovery and relevance ranking

### 5.1 Two-stage design

**Stage A — Candidate discovery**

1. Build set `U` of distinct, **recognised** user skill URIs.
2. Reverse-index lookup to retrieve the **union** of all occupations related to at least one `u ∈ U` through a documented ESCO essential or optional relation.
3. Exclude obsolete/invalid occupations and concepts and records lacking trustworthy relationship evidence.
4. Compute statistics from the **complete indexed occupational universe** for the chosen ESCO version; avoid applying frequency rules to only the original 15 records.
5. Candidate discovery remains source-backed and index-driven. A live API may enrich or verify candidates but must not be relied on to compute application scores.

**Stage B — Relevance score, safeguards, threshold and stable ranking**

Define two **separate** metrics:

#### Metric 1: Profile relevance (new, primary ranking metric)

This answers: **"How much of my documented skill profile points toward this occupation?"** It does **not** answer "how job-ready am I?".

Use a reproducible, profile-oriented **weighted overlap** method. Proposed v1 (tune transparently after synthetic-profile evaluation, never to inflate scores):

```
N = number of active occupations in the full matching-version ESCO index

df(s) = number of active occupations with a documented essential OR optional edge to skill s

idf_weight(s) = 1 + ln((N + 1) / (df(s) + 1))
relationship_strength(s, role) =
    1.0 if s is essential for the role
    0.4 if s is optional for the role
    0.0 otherwise

profile_relevance_pct(role, U) =
    100 * [sum(idf_weight(s) * relationship_strength(s, role) for s in U)]
          / [sum(idf_weight(s) for s in U)]
```

- Both `0.4` and the IDF formula are **application heuristics**, not ESCO-provided probabilities or weights. Log and document their versions, and make configuration explicit.
- If a concept is listed in both relationship types because of dirty data, **essential takes precedence**, with import anomaly logged.
- Score is in `[0,100]` if the catalogue and input are valid; no division by zero; raw fractions govern ranking, not rounded displayed percentages.
- `idf_weight` gives rarer/occupation-specific skills more influence; it cannot by itself stop a one-skill profile from being 100%, hence the **mandatory evidence safeguards** below.
- Do not use interest, education or experience in the equation without an explicit, reviewed design change.

#### Metric 2: ESCO essential coverage (retained, distinct)

```
essential_coverage_pct(role, U) =
    100 * count(distinct essential skill URIs for role intersecting U)
          / count(all distinct verified essential skill URIs for role)
```

- Retain **all** essential relationships in denominator. Keep it as a technical/secondary detail, not the primary discovery filter.
- Null/unscorable if essential-relations completeness or version consistency is not established. Never compute against only partially loaded edges.
- Label **"Documented essential coverage"**, never hiring chance/readiness.

### 5.2 Qualification rule (30% is an initial, unvalidated product setting)

Default starting point:

```
qualifies(role) =
   profile_relevance_pct(role, U) >= 30.0
   AND at_least_two_distinct_matched_canonical_user_skills
   AND at_least_one_matched_essential_skill
   AND has_at_least_one_informative_occupation_specific_match
   AND evidence_is_complete_for_scored_relationships
```

The meaning of `informative_occupation_specific_match` must be operationalised and tested from full-index statistics. Candidate rule for evaluation: at least one matched skill occurs in **no more than 25% of active occupations** (`df(s)/N <= 0.25`). This 25% is an **experimental heuristic**, not an ESCO fact; if it filters valid specialised profiles or lets generic ones dominate, adjust **with documented synthetic-profile results** before shipping. The qualifying rule must remain explicit in configuration and documentation.

Important edge cases:

- **Only one recognised skill:** show "Add more skills for reliable recommendations" and optional explorative matches marked `insufficient_evidence`, **never present them as qualified 100% matches**.
- **Only transversal skills** (e.g. communication/teamwork): don't dump hundreds of apparently precise recommendations; request more occupationally specific skills.
- **Two matched aliases** of the same URI count as **one**, not two, for safeguards.
- **0 qualifying roles** is legitimate; show a constructive empty state, allow threshold explanation/skill confirmation but don't silently lower 30% to force results.
- **Many qualifying roles:** stable sorting, pagination/"Show more", and total qualifying count. Don't impose a hardcoded 15 recommendation maximum. Backend may cap page size for performance, but expose total + cursor/page metadata.
- Display percentage label **"Profile relevance"** or **"Skill-profile relevance"**; tooltip: `Based on how your listed, recognised skills relate to this ESCO occupation; not a measure of readiness or hiring probability.`
- Do not claim ESCO produced the score or that it predicts AI-driven demand.

### 5.3 Ranking, comparability and calibration checks

Sort by:

1. `profile_relevance_pct` raw precision descending;
2. stronger essential-skill evidence (e.g. weighted essential match) descending;
3. more distinct matched canonical user skills descending;
4. stable canonical occupation URI ascending.

Use a `score_method_version` that changes if the formula/weights/eligibility rules change. Test against several synthetic personas. **Evaluate** whether overlap strongly rewards short profiles, too many generic skills or occupations with very few linked concepts. If severe anomalies emerge, stop and document targeted alternative, not a fake '70–90% better matches' claim.

Keep market trend and scenario effects **separate** from this personal relevance method. User skill relevance is not a forecast of labour demand.

---

## 6. Contract evolution: additive and versioned

**Do not silently overwrite current `personal_fit_score_pct` with a new meaning.** Inspect current Pydantic and TypeScript definitions and retain the legacy essential-coverage field/value as long as existing clients rely on it. Introduce additive fields or migrate with a deliberate schema version and compatibility mapping.

A schematic **example shape** (not assumed to be the current API; all values illustrative) for one role:

```json
{
  "schema_version": "2.0",
  "role_id": "http://data.europa.eu/esco/occupation/EXAMPLE_ONLY",
  "role_title": "Verified role label inserted by backend",
  "source_ids": ["esco_role_source_id"],
  "score": {
    "display_kind": "profile_relevance",
    "profile_relevance_pct": 42.7,
    "essential_coverage_pct": 6.2,
    "method_version": "profile-relevance-idf-v1",
    "is_hiring_probability": false,
    "matched_recognised_skill_count": 3,
    "recognised_user_skill_count": 6,
    "qualifying_threshold_pct": 30.0,
    "qualification_notes": ["Heuristic threshold, not a readiness measure"]
  },
  "strengths": [
    {"skill_id": "canonical-esco-skill-uri", "label": "verified skill label", "source_ids": ["relationship_source_id"]}
  ],
  "development_areas": [
    {
      "area_id": "mapped-group-id",
      "title": "Traceable competency group name",
      "not_yet_evidenced_count": 7,
      "supporting_concept_ids": ["real-validated-esco-uri"],
      "source_ids": ["evidence-id"],
      "mapping_method": "reviewed_esco_hierarchy_or_local_mapping"
    }
  ],
  "hidden_full_requirement_count": 52,
  "data_source_status": "local_full",
  "esco_release": "selected-compatible-release",
  "market_outlook": null,
  "pathway_available": false
}
```

**This is not production data.** Never use the example identifiers/numbers/phrases as real records. In particular, `EXAMPLE_ONLY` is an intentional non-valid placeholder.

Contract requirements:

- Preserve canonical IDs and verified `source_ids` on all roles, matching skill links and grouped development areas.
- Expose `scoring_method`, `qualification_reason`, `insufficient_evidence`, `unresolved_profile_skills`, and `total_qualifying_roles`/pagination metadata in whatever format matches existing conventions.
- Prefer **typed discriminated statuses** (`qualified`, `below_threshold`, `insufficient_evidence`, `unscorable`) over silently omitting diagnostic reasons; avoid leaking enormous default payloads of 100 requirement descriptions for each card.
- Preserve existing endpoint semantics or add versioned `v2` match endpoint. If client contracts change, migrate all React consumers and tests together. Document compatibility and removal plans; do not break Feature 4's selected-role API.
- Keep full role requirements available to authenticated/internal services if applicable, and to the reskilling backend; hiding them from the UI is **not** deleting them from the data model.
- Maintain `role_id` integrity for roles not previously present in the 15-role subset: Feature 4 must give a safe, honest response even when its small reviewed course catalogue cannot cover the role.

---

## 7. Skills gap UX redesign — compact and traceable

### 7.1 Replace current overwhelming list

Remove from the **main role card UI**:

- `View All Documented Requirements` action and enormous 50–100-row requirements dump.
- Default complete essential/optional unmatched concept lists.
- Language implying every unmentioned CV concept is definitely **missing**.

Keep the requirement graph/data **internally** for calculations, citations, technical inspection, Feature 4 input and team compatibility.

### 7.2 Show only the most useful information

On each career recommendation card, show in this order:

1. **Role name**, compact source/verified indicator, short description (two or three lines by default), `Read more` toggle.
2. **Profile relevance %** with a small bar/gauge, tooltip, plus a compact signal of evidence sufficiency (`3 relevant skills`, etc.). Secondary strict coverage is behind `Why this match?`.
3. **Recognised strengths:** maximum **three** primary matching skills; `+N` summary only if useful.
4. **Areas to explore:** show **three to five** grouped competency areas, not dozens of ESCO rows. Each area has a brief plain-language label, 1-line explanation, and a `Source` affordance if available.
5. **Actions:** `Explore pathway`, `Why this match?`, source links; pathway remains subject to current backend resource coverage.
6. At bottom of the result list, a small, collapsed **"How recommendations work / Limitations"** disclosure with method, 30% heuristic, reliance on listed skills, ESCO European orientation, meaning of 'not yet evidenced' and separate market evidence.

### 7.3 Grouping rules — don't invent skill categories

- Group **source-backed** essential concepts into useful clusters using an ESCO-provided taxonomy/hierarchy where verified. If not enough semantic grouping is provided, use a versioned, **human-reviewed local mapping** tied to canonical URIs. Explicitly label local group taxonomy as **application-defined**, not ESCO official.
- Maintain many-to-one mapping with each underlying essential concept recorded and linkable. Don't arbitrarily delete concepts; do not inflate coverage by pretending one confirmed concept confers all related skills.
- Rank areas for display by a documented heuristic (e.g. number of not-evidenced **essential** concepts, closeness to confirmed interests if explicitly modelled); don't imply difficulty/importance comes from ESCO unless backed by actual fields.
- If trustworthy grouping is unavailable for an occupation, display a truthful, concise fallback: `Some requirements could not be grouped for display` and a **small selection of actual sourced concepts**. Avoid generic invented areas like "Cloud Development" unless supported by the real role's relationships.
- Use `Areas to explore`, `Not yet evidenced`, `Skills to verify` rather than `You lack X` / `You must learn all N concepts`.
- Every shown group must have resolvable links to the underlying source-backed ESCO skill relationships. Group citation can open a compact evidence popover instead of 30 links printed on screen.

### 7.4 Compact React presentation and accessibility

- Use current design system/CSS; do **not** redesign the whole app or replace React.
- Favor small icons, skill chips, aligned cards, narrow progress bars, accordions, one-row counts and whitespace over repeated paragraphs. No fake graphs or market forecast illustrations.
- Mobile responsive; semantic buttons, `aria-expanded` on toggles, keyboard accessibility, visible focus, and proper source links. Avoid making essential information accessible only on hover.
- Avoid rendering 100 hidden DOM rows per card: fetch additional detail lazily if required; API default response should be compact.

---

## 8. Market Outlook removal without breaking Domain 1 integration

- Remove **Market Outlook** sections, `Unknown` market badges and synthetic trend switchers **from Feature 3 matching UI** where these are distracting.
- **Do not delete** shared `src/trend_adapter.py`, backend contracts, teammate-owned Feature 2 UI/logic, source metadata, scenario structures or their tests.
- If a shared component is used by Feature 2 and matching, remove only Feature 3's rendered instance, not the component globally.
- Document in UI/footer: `This score measures your listed skills' relevance to ESCO occupations. It does not include current job-market demand.`
- When actual trend data is integrated by the team, preserve a documented integration slot/contract; the overall Domain 1 submission still needs updateable trend evidence shown with a source and date elsewhere in the app.

---

## 9. Fix description Read more / Show less duplication

**Observed defect reported by user:** clicking `Read more` leaves the truncated description visible **and** appends the full description, causing duplicate text.

Required behaviour:

- Render **one** content element sourced from the verified occupation description. Default view is CSS line-clamped to 2–3 lines **or** a consistently truncated preview; expanded view shows that **same element's full content**, not a second paragraph.
- `Read more` changes to `Show less`, is a semantic `<button>`, and exposes `aria-expanded` and sensible accessibility label.
- Repeated toggles must not duplicate content; changing roles/cards must maintain correct independent state.
- Use the original source text, no LLM rewriting or invented continuation; escape/render safely as text rather than injecting raw HTML.
- Add React/browser regression test: initial preview occurs once, expanded text occurs once, collapse returns to the preview; test multi-card independence where appropriate.

---

## 10. Backwards compatibility with Feature 4

**Feature 4 is not being redesigned now.** Preserve its API, verified resource catalogue, prerequisite ordering, unknown-duration handling, provenance and test coverage.

A broader role catalogue may introduce roles with no valid learning resources. Required behaviour:

- The selected `role_id` and canonical `skill_id`s must survive matching -> pathway request without translation errors.
- If the pathway engine currently assumes one of the old 15 roles, make **only the minimal compatibility adaptation** needed to accept a valid new ESCO role without inventing a course or crashing.
- When no source-verified resources cover its gaps, show a clear **"No verified pathway resources available yet for this role"** / incomplete notice. Do not fabricate phases, durations or provider links.
- Changes to `missing_skills` versus `not_evidenced_skills` wording must not silently erase the stable canonical gap data consumed by Feature 4.
- Add at least one integration test selecting a newly discoverable occupation absent from the prior subset and requesting a pathway, verifying safe partial/unavailable handling.
- Do not implement the separate previously discussed learning-pathway enhancements here; owner has explicitly deferred them.

---

## 11. File-level implementation targets (verify actual paths first)

Likely relevant files from earlier implementation reports:

| Area | Possible files to inspect/change | Purpose |
|---|---|---|
| Import & index | `scripts/prepare_esco_subset.py`, new full-import/index script(s), `data/`, source manifest | Full ESCO ingestion and inverted lookup |
| Data access | `src/data_repository.py`, optional ESCO API adapter, cache | Canonical records and API/local fallback |
| Matching service | `src/future_role_matching.py` | Discovery, relevance, qualification, ranking |
| Validated models | `src/models.py`, `docs/CONTRACTS.md`, `src/frontend/lib/contracts.ts` | Additive or versioned result contracts |
| API | `src/main.py` | Dynamic matching, pagination, sources and status |
| UI | `src/frontend/app/page.tsx`, `src/frontend/components/CareerCard.tsx`, `SourceLinks.tsx`, CSS | Compact cards, new relevance metric, missing areas, description fix |
| Trend integration | Existing trend adapter and references | Preserve without showing unknown section in matching UI |
| Tests | `tests/test_matching.py`, `test_api.py`, `test_contracts.py`, `test_provenance.py`, `src/frontend/e2e/` | Regression, dynamic discovery, score formulas and UI |
| Docs | `README.md`, `docs/SCORING_AND_LIMITATIONS.md`, `docs/DATA_SOURCES_AND_LICENSES.md`, `docs/VERIFICATION.md` | Architecture, source attribution, setup, results and limitations |

Do not assume filenames are identical; respect the actual project layout and current repository conventions. Avoid adding redundant wrapper layers or large new dependencies without clear value.

---

## 12. Test plan and objective acceptance criteria

### 12.1 Unit / backend tests

- **Full ESCO import**: all non-obsolete occupations/skills/edges from selected data release are indexable, counts checked against actual source; not just 15 hard-coded roles. Record expected counts from the actual import, not guesses.
- Deduplicate URIs/aliases and preserve essential versus optional edge semantics; reject source-inconsistent or incomplete records.
- Dynamic discovery: different synthetic profiles produce different candidate sets and qualifying role counts; occupation universe is complete for the imported release.
- Scoring: exact arithmetic for IDF weighting, essential = 1, optional = 0.4, 30% threshold boundary, zero denominator, null strict coverage when source incomplete, stable ties, raw-score sorting, values in [0,100].
- **Short/generic profile safeguards**: 0 skills, 1 generic skill, 2 synonyms of one URI, 2 transversal skills; no high-confidence false precision.
- Candidate qualification: >=2 distinct canonical skill matches, >=1 essential, informative match, full evidence and >=30% relevance.
- Evidence: every returned occupation, skill relationship, area and source links to valid source records. Reject forged client-`verified` flags and made-up URIs.
- API adapter: timeout, unreachable API, malformed payload, version mismatch, cache hit/miss, pagination, fallback to pinned local release. No false live provenance.
- No N+1 API calls on every match request; evaluate request count/performance.
- Feature 4 compatibility for role not in previous fixed catalogue; no bogus courses.
- Protect existing Feature 2/5/6 contracts and endpoint behavior.

### 12.2 Synthetic-persona evaluation

At minimum build/run fixtures for:

1. Software/data skills: Python, SQL, machine learning (with valid canonical IDs).
2. Web skills: HTML, CSS, JavaScript, React (only where mapping/URIs are verified).
3. Business/accounting skills: Excel, accounting, financial reporting (where valid ESCO mappings exist).
4. Only "communication" or similarly generic skill.
5. Two generic/transversal skills.
6. One specific skill only.
7. Unknown/typo skills, unresolved aliases, empty input.
8. More than five recognised skills including unrelated skills.

For each, report: recognised count, qualifying roles, top result IDs/titles, relevance %, original essential coverage %, safeguard flags and why any result qualified. No hard-coded expected occupation titles unless the imported source data supports them. Compare old/new scoring on overlapping roles to show the difference in **meaning**, not "percentage improvement".

### 12.3 Frontend / browser tests

- No Market Outlook/Unknown synthetic market panel in matching results.
- Every career card shows compact profile relevance and **at most 3–5** source-backed development areas, not 50–100 textual skills by default.
- No `View All Documented Requirements` control in primary UI.
- Correct Read more/Show less without repeated description.
- Qualifying result count varies across profiles; pagination/Show more works; empty state is helpful and honest.
- `Why this match?` and condensed footer explain formulas, limitations and sources.
- Changing profile invalidates stale results and cancels/ignores stale requests.
- Mobile layout, focus/keyboard navigation, visible links and pending/error states work.
- Selecting a new dynamically discovered role does not break Feature 4's pathway request.

### 12.4 Nonfunctional goals (measure, don't invent results)

- Normal profile matching uses local index; no upstream network call needed per role. Time requests on development hardware and report actual latency for representative profiles.
- If needed, introduce indexed queries and bounded pagination rather than loading full descriptions/skills for every occupation into card payloads.
- Offline mode works with documented limitations; API outage never produces uncaught frontend errors.
- Use no paid dependencies or required LLM services.
- Update and execute `pytest` / frontend type checking / production build / Playwright tests (adapt commands to actual repository); do not claim tests passed unless run.

### 12.5 Definition of Done

This change is **done** when all of the following hold:

- [ ] Candidate occupations are discovered from the wider complete index, **not a fixed list of 15** (or a clearly labelled limited fallback if full ESCO data is genuinely unavailable).
- [ ] Official API adapter is validated against documented supported version(s), with proper offline/version fallbacks; actual source/version shown.
- [ ] Recognised user skills drive a **variable number** of results that pass **30% relevance plus safeguards**; no padded fixed-count recommendations.
- [ ] Primary UI clearly labels **Profile relevance**; strict ESCO coverage remains separate and auditably accessible.
- [ ] Skills not listed in a profile are described as **not yet evidenced**, not proven absent.
- [ ] User sees **3–5 traceable development areas**, not all 50–100 concept rows.
- [ ] Market Outlook placeholder removed **only from matching UI**; team trend contracts are intact.
- [ ] Role-description Read more/Show less is fixed and regression-tested.
- [ ] Existing reskilling module functions, or reports honest limited coverage for newly discovered roles.
- [ ] Every displayed occupation/skills claim is backed by a verified source; release/provenance and threshold are documented.
- [ ] Tests, build and example before/after runs actually executed; documentation updated.

---

## 13. Expected deliverables and final report format

Provide:

1. **Repository audit:** exact pre-change files, current roles count, data versions, baseline tests, current contract mapping.
2. **Implemented features:** full ESCO indexing, official API client/fallback, dynamic discovery, new scoring, qualifications, UI simplification and bug fix.
3. **Algorithm contract:** formula, constants/weights, source-backed semantic mappings, query/filter/sort/pagination behaviour, method version and limitations.
4. **Evidence manifest:** source links, ESCO version, dataset acquisition procedure, downloads/licenses, hashes, indexed record/edge counts and API compatibility status.
5. **Changed file map** with reasons, and any legacy compatibility adapter.
6. **Results and verification:** tests actually executed with pass/fail counts; comparison table for at least three synthetic personas; API/local fallback tests; browser screenshots only if actually captured; measured latency if evaluated.
7. **Open issues:** manual dataset download required, coverage limitations, threshold anomalies or unknown terms, missing mappings, unavailable API or unavailable learning resources.
8. **Run/rebuild commands** for Windows PowerShell from repository root and exact frontend route. Keep the existing `uvicorn main:app --app-dir src --reload` and Next.js proxy conventions if still valid.

**No fabricated success statements.** If a full ESCO file is not available, implement all feasible code/UI improvements, preserve honest subset fallback and clearly report that full discovery is **blocked until dataset acquisition**, including exact operator steps to unblock it. Never substitute an unaudited list of generic roles.

---

## 14. Concise prompt to paste into Codex Agent Mode

> Read `docs/SDC_Domain1_Future_Role_Matching_Approved_Enhancements_Codex_Handoff.md` and the repository's existing Domain 1 handoffs. The product owner has **approved** these changes. **Implement them now**, not another planning-only response. Start with a repository and test audit; then enhance **Feature 3 only** with full-ESCO-backed dynamic occupation discovery, a version-aware official API adapter and safe local-index fallback, explainable 30% profile-relevance filtering with safeguards, simplified sourced development-area cards, removal of the Market Outlook placeholder from matching UI, and the Read more duplication fix. Preserve strict ESCO coverage as a separate measure and maintain all Feature 4/2/5/6 integration contracts. Verify sources and never invent ESCO records or results. Run tests, type-check and build, then report actual outcomes, limitations and source/version details. Do not commit or deploy.

---

## 15. Sources & constraints to cite in project documentation

1. Aiversecity *Domain 1: Problem Statement & Marking Rubric*, esp. pp. 3–7 (provided in project materials): must-have features, AI/source rules, and assessment focus.
2. ESCO — Download official classification and release selection: <https://esco.ec.europa.eu/en/use-esco/download>.
3. ESCO — Use ESCO services/APIs: <https://esco.ec.europa.eu/en/use-esco/use-esco-services-api>.
4. ESCO — Web-Service API versions and `selectedVersion`: <https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api>.
5. Official REST API reference (methods may need live verification): <https://ec.europa.eu/esco/api/doc/esco_api_doc.html>.

> **Source provenance notice:** ESCO is a **classification of occupations and skills**, not a validated model of Malaysian hiring demand, AI-driven job growth, job-readiness probabilities, or learning time. The proposed 30% threshold, IDF weights, relationship strengths, and evidence-specificity guard are *application-defined rules* that must be labelled, versioned and tested rather than attributed to ESCO.
