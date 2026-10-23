# Current v2 discovery and preserved legacy contracts

The current matching UI uses **POST /api/v2/matches**, schema version **2.0**, with nested existing v1 UserProfile. Legacy /api/matches retains its v1 essential-coverage semantics and 15-role subset for compatibility. /api/pathways stays v1 and uses the selected canonical role from the full index. The sections below document legacy contracts; this update supersedes only matching presentation/discovery.

New endpoints: GET /api/v2/bootstrap (bounded seed skills/sources and synthetic profiles), GET /api/v2/skills?q=... (max 40), POST /api/v2/matches, GET /api/v2/roles/detail?role_id=... (lazy full evidence), GET /api/esco/lookup and GET /api/esco/search (explicit official lookups only).

DiscoveryRequest supports profile, page_size (1-25, default 5), offset, role_query, qualification_threshold_pct (default 30) and existing optional trend/scenario/SDG/source fields. Incoming source identities cannot self-verify or override registered evidence. The graph and global frequencies never come from an HTTP client. DiscoveryResponse returns qualified compact role cards, distinct relevance/strict scores, sources, applied query, total/filtered counts, next_offset, index/profile fingerprints and typed qualification counts. It contains no market_outlook or full missing-skills dump. Qualification is never padded to five.

Changing query/profile invalidates pagination. Display sorting uses raw relevance, weighted essential evidence, distinct match count and native URI. Areas are display mappings only; exact essential/optional relations remain in the local index and lazy detail service. ESCO returned-version metadata is null when the upstream does not provide it. Normal matching uses local_full, or an explicit local_subset_fallback; it never implies a live market feed.

The selected-role pathway adapter avoids the old top-100 limit and preserves canonical gap data for the unchanged engine. Source versions/metadata for existing registered records remain compatible. No removal of v1 is scheduled. Regenerated schemas include 11 legacy envelopes and 2 discovery envelopes. See FUTURE_ROLE_IMPLEMENTATION.md for the exact method and limitations.

---

# Versioned service contracts and team integration

Python `src/models.py` is the source of truth. Exported JSON Schema files are in `docs/schemas/`; refresh with `python scripts/export_contract_schemas.py`. FastAPI also serves `/docs` and `/openapi.json`. Every envelope requires `schema_version`; only `1.<integer>` is supported. New optional fields in major version 1 are ignored by older consumers; semantic changes need an explicit adapter/version change.

## HTTP API

| Method | Path | Input / output |
|---|---|---|
| GET | `/api/health` | Existing health endpoint |
| POST | `/api/summarize` | Existing numeric helper, preserved |
| GET | `/api/bootstrap` | Canonical skills, role summaries, synthetic profiles, registered sources, selectable snapshot metadata and integration status |
| GET | `/api/catalogue` | `OccupationCatalog` including complete role requirements |
| GET | `/api/sources` | `SourceRegistry` |
| POST | `/api/profiles/normalize` | `UserProfile` -> canonical `UserProfile`; unresolved terms retained |
| POST | `/api/matches` | `MatchRequest` -> `MatchResponse` |
| POST | `/api/pathways` | `PathwayRequest` -> `PathwayResponse` |

Frontend calls these paths on its own origin; the existing Next.js rewrite preserves `/api` when forwarding to FastAPI. No browser-side backend URL or CORS workaround is needed.

`MatchRequest` contains the actual `profile` object, `top_k` (1–100, default 5), optional `trend_snapshot_id` OR inline `trend_snapshot`, optional `scenario_config`, optional `sdg_mappings`, and `integration_sources` (default empty). `PathwayRequest` adds `role_id`. The stateless API computes a trusted match before giving its gaps to the pathway service; clients cannot submit invented gap/score arrays. No user/profile database exists.

Example from Python (only synthetic profile data):

```python
import httpx
base = "http://127.0.0.1:8000"
boot = httpx.get(base + "/api/bootstrap").json()
request = {
    "schema_version": "1.0",
    "profile": boot["profiles"][0],
    "trend_snapshot_id": "demo-trend-a",
    "top_k": 5,
}
matches = httpx.post(base + "/api/matches", json=request).json()
pathway = httpx.post(base + "/api/pathways", json={
    **request, "role_id": matches["results"][0]["role_id"]
}).json()
```

Expected failures: 422 for incompatible schemas/invalid fields/integration conflicts; 404 for an unavailable selected role; 503 for missing/invalid local catalogues. A valid empty/unresolved-only profile returns an empty match list and warnings. Existing health does not certify catalogue readiness; bootstrap validates it.

## Feature 1: replaceable intake

Replace `components/ProfileIntake.tsx` while preserving `UserProfile`. Canonical IDs are full native ESCO URIs (HTTP identifiers are retained as identifiers; evidence links use HTTPS). `is_synthetic` must be true in this prototype. Required profile fields: schema version, pseudonymous profile ID, synthetic flag and skills array. Levels are self-reported; unknown stays unknown. Optional education, experience and interests do not affect baseline scoring.

Reviewed aliases are exact case-insensitive label/alias matches. No fuzzy matching. Duplicate canonical input IDs are rejected; aliases resolving to one canonical concept count once. Unknown terms appear in `unresolved_skills` / `unmatched_user_skills`. Fingerprints bind results to the normalized profile; UI edits invalidate old matches/pathways and abort pending requests. Nothing is persisted in browser storage or the backend.

## Feature 2: observations adapter

Supply an inline `TrendSnapshot` to matching and pathway requests. Static ID resolution currently selects local A/B fixtures. The pure adapter also accepts an explicit crosswalk dictionary; upstream ingestion should apply a reviewed ID map before producing a canonical snapshot.

Owner must supply source identity, observed windows, metric/units, geography, derivation method, collection timestamp, refresh process and optional `valid_until`. `comparability_confirmed` is false by default. Overlapping/unequal windows, future observations, unverified provenance and conflicting count directions yield unknown; they do not alter personal fit. Stale observations are retained with warnings. Skill signals stay skill-level. Multiple role metrics are not merged into a new trend label. Source-declared direction is distinct from the implemented `count_comparison_v1` method.

No refresh API, credentials or paid service has been adopted by this contribution. The teammate owns fetching, licensing, refresh failures and source comparability. An approved local snapshot is the offline fallback; it is not evidence of a live refresh. There is no public endpoint that fetches arbitrary URLs.

## Feature 5: SDG mappings

`SDGMappingSnapshot` contains `snapshot_id`, `role_sdg_mappings` and `skill_sdg_mappings`, keyed by canonical IDs. Each mapping has SDG number (1–17), reason, source IDs, mapping owner and status (`verified`, `proposed`, `unknown`). Unknown target IDs are rejected. Verified status requires registered evidence with the `sdg_mapping` claim. Role cards render supplied mappings and citations; absent mappings are pending. Complete means a verified role mapping and verified mappings for all its requirement concepts.

## Feature 6: scenario context

`ScenarioConfig` carries scenario ID, version, synthetic flag, display label, assumptions, model method, sources and disclaimer. Keep moderate/fast objects separate from observations. Undefined methods are illustrative/pending. This contribution preserves and returns scenario context; it implements no numerical disruption transformation or future-priority ranking. The scenario owner must provide that method before claiming final scenario functionality.

## Evidence trust boundary

Sources for new real evidence must first be reviewed and registered in `data/sources/integration_sources.json`, with a verification record, correct claim types and publication/observation dates. Restart the backend after changing reviewed catalogue files. HTTP clients cannot self-assert a new verified source or override an existing registry entry. Inline unverified/synthetic evidence never becomes verified through successful schema parsing.

Supported claims include `occupation`, `skill_labels`, `role_skill_relationships`, `resource_content`, `skill_mapping`, `duration`, `free_access`, `cost`, `trend_observation`, `sdg_mapping`, `scenario_method`. Role-skill sources are checked against the native occupation record. A single homepage citation is insufficient evidence for a specific claim.

An output can have a synthetic profile, verified ESCO occupation and synthetic trend simultaneously: envelope `is_synthetic` stays true; individual evidence statuses preserve those distinctions. Dates use ISO format; trend timestamps require time zones. Nonfinite numbers, negative costs, invalid capacity and duplicate foreign IDs are rejected.

## Additive 1.1 enhancement fields and compatibility

`MatchResponse` and `PathwayResponse` now emit schema version `1.1`; existing `1.0` requests remain valid. Public endpoints and original fields/meanings are preserved. Generated schemas and TypeScript contracts include:

- Match: `essential_concept_coverage_pct` equals old `personal_fit_score_pct`; `competency_alignment_pct` is null; `display_score_kind=essential_concept_coverage`, `score_method_version=essential-skill-coverage-v1`, `score_is_employment_probability=false`, empty `competency_groups`, `score_limitations`, `requirement_type_coverage`, `priority_gap_skill_ids` and explicit `gap_priority_rule`.
- Envelope: `ranking_basis=essential_concept_coverage`, `candidate_role_count`, `scored_role_count`. Default API `top_k` remains 5. The frontend requests up to 100, initially renders five, then offers See more/search; Python remains the ranking authority.
- Profile preferences: `study_days_per_week` defaults to 5, accepts integer 1-7. It affects scheduling only; hours/week is separately supplied.
- Resource authoring: `planning_scope` and `scope_review_note`. Returned pathway resources additionally have computed `time_estimate` with value/unit/basis, provider flag, rule ID and explanatory notes. Existing duration fields remain unchanged. Imported raw resource catalogues may have null `time_estimate`; the pathway service computes it from reviewed fields.
- Phase: `phase_kind` and `planning_estimate`. Compact phases preserve topological resource order; prerequisite study can occur earlier within the same phase.
- Pathway: `planning_estimate`, `coverage_complete`, `timeline_is_estimated=true`. Provider hours, reviewed app hours and fallback study days have separate subtotals. `scheduled_weeks`/`scheduled_study_days` cover selected materials only, remain null if a selected duration or needed capacity is unknown, and do not imply complete skill coverage. Legacy `estimated_weeks` still represents a complete all-hours plan only.

Catalogue expansion changes `dataset_id` from `esco-five-tech-roles` to `esco-tech-shortlist`; native role/skill IDs and ESCO v1.2.1 are stable. New candidates can change ranks without changing any original fractions. Teammates should use canonical IDs, accept additive minor versions and avoid assuming five candidates or fixed phase counts/titles. Strict external clients accepting only the literal `1.0` string need to accept supported 1.x minor versions. No teammate trend/SDG/scenario request shape, trust boundary or numerical ranking effect changed. Restart FastAPI after data changes to refresh its cached bundle.

Normalised profile fingerprints include the default scheduling convention in 1.1 models. Recompute them after upgrade; they bind a normalised profile, not a permanent cross-version identity.
