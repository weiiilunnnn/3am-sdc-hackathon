# Course discovery: related topics and unknown prices

The existing reviewed provider allowlist, canonical HTTPS URL checks, extraction
identity, title agreement, accessible learning-page checks and prerequisite
review requirements remain in force. Search titles/snippets never establish
curriculum support. No new model calls, dependencies or provider requests were
added to discovery.

## Relevance

`resource_verification.curriculum_relevance` inspects short passages from actual
Tavily Extract provider content, excluding the page's main heading. Passages need
learning context, and negated claims are withheld. Literal ESCO labels/aliases
continue to populate `covers_skill_ids` as partial learning support.

Nonliteral matches use a small, explicit linguistic topic vocabulary (such as
analyse/analysis, datasets/data, visualization/charts/plots and
statistical/statistics), stop words and token overlap. Multiword labels need at
least two shared topic tokens covering sixty percent of the label's meaningful
tokens; single-topic hints require a small distinctive-topic allowlist. This is
a conservative lexical heuristic, not embedding similarity or an ESCO equivalence
model. It cannot recognize arbitrary synonyms or prove competence.

Nonliteral matches populate **only** `related_skill_ids`, with original provider
excerpts in `mapping_evidence` and explanations in `relevance_notes`. They are
labelled suggested related resources, never confirmed ESCO coverage. The source
claims `related_learning_topic`, rather than `skill_mapping`, when there is no
literal mapping. Optional existing Runpod evaluation may rank candidates but
cannot promote a related topic into confirmed coverage.

## Selection and presentation

The additive `PathwayResponse.alternative_resources` field carries content-checked
resources that cannot enter the confirmed affordable plan. The existing
prerequisite graph, ranking, scheduling and coverage calculations remain intact.

- Unknown prices remain `cost_status="unknown"`, with no fabricated amount.
  They display **Price not verified — check provider** as alternatives, including
  for free-only users. They do not count toward plan hours or gap coverage.
- Suggested related resources are alternatives even when verified free. Their
  topic connection still needs review before treating it as ESCO coverage.
- Verified paid courses outside the user's budget/currency, or the remaining
  cumulative plan budget, may be shown as alternatives with the explicit reason.
  Their verified price is retained; they are not represented as affordable.
- Verified-free resources keep their free-access evidence and normal selection
  eligibility. Local catalogue resources and prerequisite IDs retain precedence
  when the same canonical URL is already curated.

The frontend uses the existing course card for a separate Additional Learning
Resources section. It shows origin, provider URL, warning, relevance explanation
and short attributed curriculum excerpts. Alternative citations are included in
the response's `sources`. Existing response fields retain their meaning.

## Diagnostics and limits

`discovery_metrics` separates `search_results`, unique `candidate_urls`,
`extracted_pages`, `content_verification_failures`, `skill_relevance_failures`,
`verified` provider resources, `confirmed_mapping_resources`,
`suggested_related_resources`, unique `pricing_exclusions`, `displayed_resources`,
`displayed_alternatives`, `selected_web_resources` and `alternative_web_resources`.
Cached retrievals zero the actual search/extract/failure counters and report
`cached` separately. Selection logs contain aggregate numeric counts only.

`discovery_status` still describes the confirmed plan; a catalogue fallback may
coexist with online alternatives, which the message and counters explain.
Discovery remains bounded by existing query, candidate, deadline and cache limits.
Disallowed providers, unavailable/contradictory pages, insufficient topic support
and unmapped explicit prerequisites can still prevent display. No claim is made
that all relevant courses can be found or that live services are available.

## Mocked verification

Focused Python discovery, reskilling, API and integration checks cover nonliteral
topics, unrelated/negated/snippet-only pages, unknown/free/paid pricing, local
fallback, URL duplicates, evidence, caching and response serialization. Frontend
component checks cover separate alternatives, warnings and omitted unsupported
metadata. No live Runpod or Tavily calls are authorized by these checks.

The historical byte-freeze test in `test_discovery_integration` is already stale:
committed `HEAD` does not match its planner, PathwayView or catalogue/source
hashes. It is not updated merely to mask that unrelated baseline issue. Functional
regression checks remain the validation for this approved change.
