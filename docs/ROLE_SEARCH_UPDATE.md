# Occupation title search override

The existing page now debounces non-empty title searches by 300 ms and uses
`POST /api/v2.1/roles/search` with `schema_version: "2.1"`. Its request otherwise
uses the existing discovery fields (profile, role_query, page_size, offset and
integration context). Page size remains bounded to 25, default 5.

Search checks the full validated local index's preferred titles and official
alternative labels. Search results are ordered by full-precision backend profile
relevance descending before pagination, with unavailable scores last. Score ties
use exact preferred title, exact alternative, preferred prefix/substring, then
alternative prefix/substring, normalised title and canonical URI. No semantic guesses or network
requests are made. The recommendation scorer is unchanged.

Results carry `qualification_status: "search_result"`, the same relevance-score
arithmetic and compact evidence, plus `score_unavailable_reason`. Recognised
profiles with zero overlap receive 0%; profiles without recognised skills or
complete scoring evidence show Not assessable. Search never claims readiness.
The response adds `total_search_results`; status is `search_results` or
`no_title_matches`. Inherited qualification counts/diagnostics retain their
original recommendation meanings and do not count title search results.

Clearing the field (including whitespace) cancels pending search, immediately
restores cached first-page recommendations when available and requests the
unchanged `/api/v2/matches` flow. Abort handling prevents stale responses from
overwriting results. Profile edits invalidate the cache and pending debounce.
Search remains available even when no occupation qualifies for recommendation.
Descriptions, citations, development areas, selected-role details and the
existing pathway handoff remain available.
The unchanged pathway service requires recognised profile skills. For an
unassessable search result its button is disabled; the scoring reason remains
visible. A recognised profile with 0% relevance can still open a pathway.

No changes to the scoring module, ESCO index/data, recommendation threshold,
Personalised Reskilling internals or integration safeguards. No new dependencies.

## Verification (2026-10-22)

- Existing discovery baseline: 16 tests passed.
- New full-index/API search tests: 5 passed, including independently calculated
  below-threshold relevance, exact-title priority, aliases, full-index pagination,
  zero/unknown profiles, citations, request limits and selected-role navigation.
- Complete backend regression: 75 passed. The 5 search tests passed again after
  the final pathway-availability guard, including a 0%-score pathway request.
- Complete browser regression ran once: 12 passed; the empty-profile pathway
  test exposed the existing recognised-skill requirement. After the compatibility
  guard and matching test update, that single test passed (30.9 seconds overall).
  All 13 browser scenarios therefore have passing results across those runs;
  the complete browser suite was not rerun after the fix.
- TypeScript checks and production build passed. Final TypeScript and whitespace
  checks passed after the last compatibility change. No full rebuild after that
  small boolean/display change.
- Playwright's missing browser was downloaded into ignored `.playwright/` for
  execution. Application dependencies and test configuration were unchanged.

Changed implementation files: `src/role_search.py`, `src/discovery_models.py`,
`src/main.py`, frontend `app/page.tsx`, `components/CareerCard.tsx`,
`lib/contracts.ts`. Tests: `tests/test_role_search.py`, frontend
`e2e/role-search.spec.ts`, and the two renamed search-field selectors in
`e2e/workflow.spec.ts`. The schema exporter adds the two new search schemas;
existing schemas are unchanged. The supplied request was copied from Downloads
to its requested `docs/` location because that repository file was absent.

## Relevance-first search update

Search now computes the existing scores for all title matches before slicing
pages, sorting by full-precision relevance descending, unavailable scores last.
Text relevance/title/URI remain deterministic tie-breakers. No formula, weight,
qualification rule, API contract or recommendation behaviour changed.

Validation: 15 focused backend tests passed (6 search, 9 discovery/scoring);
the focused browser pagination/order/empty-state test passed; TypeScript and
whitespace checks passed. Full regression suites were not rerun for this change.
