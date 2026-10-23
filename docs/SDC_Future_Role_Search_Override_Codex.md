# Codex Change Request — Career Search Overrides Recommendation Filter

## Goal
Make **one narrow change** to the existing SDC Domain 1 Future-Role Matching page (Next.js/React + FastAPI). **Keep the existing v2 matching algorithm intact.** A non-empty job-title search must find occupations in the **full locally indexed ESCO catalogue**, including occupations below the current 30% profile-relevance threshold. Clearing the search returns immediately to the original qualified recommendations.

## Behaviour (source of truth)

| Search input | Result set | Scores |
|---|---|---|
| Empty or whitespace-only | Existing `/api/v2/matches` recommendation flow; keep 30% threshold, evidence guards, ranking, pagination | Existing algorithm, unchanged |
| Non-empty job title | Search the **full local ESCO occupation index** by preferred title and verified alternative labels; do **not** restrict to the qualified recommendation pool | Compute/display the **same existing profile-relevance score** for each found role, even below 30%; never relabel it as readiness |
| Cleared after searching | Restore original recommendations (same as initial empty state) | Existing algorithm and ranking, unchanged |

- Example: Searching `Data Scientist` displays that verified occupation even if its profile relevance is **5%, 0%, or below 30%**, provided it exists in the index. Do not use the 30% qualification check to suppress explicitly searched occupations.
- Sort search results primarily by **textual title relevance**: exact preferred title, exact official alternative label, title prefix/partial matches; use deterministic ties. The exact searched occupation must not get buried behind less-relevant titles with higher profile scores. Related results only if supported by real indexed labels/relationships; do not invent semantic similarity.
- Show the **real computed score** and existing compact skill evidence for each searched occupation. If the profile has no recognisable skills or scoring is genuinely unavailable, show **“Not assessable”** with a reason—not a fabricated percentage. Label these as **search results**, not qualified personalised recommendations.
- Preserve source citations, role descriptions, compact gap breakdowns, selected-role details/pathway navigation, loading/empty/error states and versioned contracts.
- Search uses the **existing validated local ESCO index**; no upstream ESCO API calls for each keystroke. Keep existing backend-only API lookup functionality intact.

## Implementation constraints
1. **Inspect only the necessary current files** first (matching endpoint, occupation index, profile relevance/scoring service, page search state, CareerCard and API client). Reuse existing APIs/helpers if suitable; otherwise add **one small, bounded search path** with an additive, versioned response contract. Do not change existing endpoint meanings or alter `profile-relevance-idf-v1`.
2. Current v2 title filtering applies to qualified matches. Ensure typed search is instead executed against the full occupation index **before qualification**, independently of that filter. Compute a score for each verified found occupation using existing scorer logic without enforcing recommendation qualification. Do not accidentally expose only the first 5/25/100 qualified occupations.
3. Preserve a single search field on the **same Future-Role Matching page**. No new page, tabs, redesign, architecture changes or LLM.
4. Debounce requests sensibly; cancel/ignore stale responses. Whitespace counts as cleared. Keep search pagination bounded and accurate; display a useful message for no title matches. Ensure clearing search restores results without a stale search response overwriting them.
5. **Do not modify** Personalised Reskilling internals, score formula/weights, 30% recommendation threshold, informative/essential evidence guards, ESCO data/index, trend/SDG/scenario integrations or unrelated modules. Keep any changes to pathway handling strictly compatibility-only if needed.

## Minimal required tests
- Empty search: original recommendations, qualification threshold, score/ranking and pagination unchanged.
- Search exact indexed role below 30%: role shown with unchanged calculated relevance and verifiable source; exact title ranked first.
- Search partial title / indexed official alias: results from full index, not just qualified subset.
- Clear search (including spaces): returns original recommendations automatically; no stale results.
- Unknown title: empty search state; empty/unrecognised profile: occupation remains discoverable but score is honestly unavailable or calculated as appropriate.
- Existing selected-role navigation works. Run focused backend and frontend tests first, then the relevant full regression suites **once** if practical.

## Token-usage discipline
- **Implement directly**; no new detailed plan or large narrative. Inspect only relevant code, and do not reread long handoffs unless blocked.
- **Never print** the full ESCO index, huge API responses, complete files or verbose test logs. Report concise errors and test summaries only.
- Prefer targeted edits and reuse existing functions. Avoid unrelated refactors, new frameworks, remote API research or refreshing 3,658 occupation records.
- Final report: changed files, actual search/clear behaviour, tests run/results, any limitations. Do not claim tests passed unless executed.

**Acceptance criterion:** With the same profile, an empty search displays the original algorithm-qualified careers; typing a verified occupation name can display that occupation regardless of its score; clearing the text immediately restores the original recommendations. The match-score algorithm remains byte-for-byte unchanged where feasible.
