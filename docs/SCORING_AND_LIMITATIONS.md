# Current Future-Role Matching method

`profile-relevance-idf-v1` discovers the union of indexed occupations with a documented edge to a recognised listed skill. For the full active universe, w(s)=1+ln((N+1)/(df(s)+1)). Relevance is 100 times the weighted profile overlap divided by all recognised listed-skill weights; essential strength is 1, optional 0.4. These are application heuristics.

A qualified role needs raw relevance >=30% (configurable), >=2 distinct matched canonical concepts, >=1 essential match, complete evidence and >=1 non-transversal match with df/N<=25%. All statistics use the complete pinned index, not the legacy shortlist. Sort by raw relevance, weighted essential evidence, matched count, canonical URI. Display rounding does not affect qualification/rank.

Strict essential coverage still uses matched/all essential concepts and remains separate; personal_fit_score_pct is never silently repurposed. Profile omission means not evidenced, not confirmed absence. Proficiency, interests, education, experience, trends and scenarios do not alter relevance. Unknown/ambiguous terms are retained. One-skill, duplicate-alias and generic-only profiles produce no padded recommendations.

Areas use verified broader-skill edges with a deterministic single-parent display rule; unmapped concepts use actual source labels. This is not a new domain-alignment score or a claim that one skill confers a whole area. All requirements remain in the denominator/graph. The 15-role offline fallback cannot establish full frequency evidence and therefore withholds qualification rather than applying IDF to a biased shortlist.

Actual evaluation: 13 synthetic profiles, 3,658 occupations, 14,579 concepts. A/B/C qualify for 11/27/0 roles. The mixed eight-skill profile qualifies for none; unrelated recognised skills dilute overlap. Threshold/specificity settings are not calibrated employment predictions. See FUTURE_ROLE_IMPLEMENTATION.md and discovery-evaluation.json for all values and before/after meanings.

The following documents preserved legacy scoring and the unchanged reskilling engine.

---

# Scoring, ranking and learning selection

## Personal fit

`essential-skill-coverage-v1` computes `100 * matched_essential / total_essential`, rounded to two decimals for output. Includes knowledge concepts and skills; unknown concept types remain unknown and are not dropped. All essential concepts contribute equally. Full ESCO requirement sets are retained (24/63/26/31/20 essential concepts for software developer/data scientist/web developer/AI engineer/database developer respectively).

Order uses the exact fraction descending, then canonical role URI ascending. Optional concepts, interests, education, experience and proficiency have no score weight. Unrelated profile skills do not penalise a role. Empty profiles get onboarding; nonempty profiles with no overlap can get 0%. Missing essential evidence yields an unscorable result; unsupported relationships exclude the role rather than shrink its denominator. A low score is broad requirement coverage, not an assessment of potential. A 100% score is not validated proficiency or employment probability.

The fictional three-skill unit fixture gives 2/3 = 66.67%; it is not a real occupation. Actual demo profile A lists only 2/31 AI engineer essential concepts (6.45%). Profile B lists 3/26 web developer essentials (11.54%). These small percentages are honest consequences of the full source definitions, which include broad professional/research concepts, not specially tailored graduate job descriptions.

## Starter learning pathways

Targets are the selected match's missing essential concepts. Resources require reviewed syllabus mappings, access evidence and resolvable source IDs. The catalogue has 22 reviewed provider-linked resources (ten course entries); it does not cover every requirement. These are functional starter pathways with explicit uncovered gaps, not complete occupational training programmes.

Selection greedily maximises additional eligible target coverage, then prefers selected formats, known shorter prerequisite-inclusive duration and stable resource ID. This is a deterministic heuristic, not a claim of globally optimal curriculum selection. It expands explicit resource prerequisites and missing prerequisite skills with eligible material. Resource dependencies are topologically ordered and shared resources count once. Cyclic/unavailable branches are withheld. Provider notes retain prerequisites outside the linked concept subset, such as MDN's HTML requirement. Selected prerequisites retain dependency edges until studied; selecting them earlier does not make them completed. Consecutive stages of the same format are compacted while preserving resource order. Foundations, Guided Practice and Online Courses appear conditionally; no empty or unsourced project phase is forced. Self-reported prerequisite skills are not assessed mastery.

Only verified free content is in the shipped catalogue. The engine can handle reviewed, known prices in the user's currency, enforcing the total budget including prerequisites. No unknown-cost option or unsupported currency conversion is selected. Credential fees and cloud charges are excluded from free content claims.

Provider estimates take priority and are not guarantees. Legacy `duration_hours`/`duration_basis`, `total_known_hours`, `all_phase_durations_known` and complete `estimated_weeks` retain their old meaning: no fallback day is converted into a published-hour fact, and complete estimated weeks still require full gap coverage and known hours.

New `time_estimate` on returned pathway resources distinguishes `provider_published`, `reviewed_app_estimate`, `app_rule_of_thumb` and `unknown`. A reviewed short article/tutorial/documentation unit without duration uses one planned study day. A reviewed bounded course without duration uses one planned study week. Large programmes/manuals, including CS50 and Python tutorial/pdb, retain unknown time without a scope-aware estimate. Provider curriculum week labels are not total study hours. Rules are app conventions, not completion/mastery promises.

`planning_estimate` reports provider hours, reviewed app hours and fallback study days separately. Default one planned study week = five study days, configurable 1-7 in the profile. Selected-material schedule = `(provider_hours + reviewed_hours) / hours_per_week + fallback_days / study_days_per_week`. Hours require a positive user capacity; no default capacity is invented. Unknown selected-resource times make the combined schedule null; known subtotals remain visible. The selected-material schedule can exist despite uncovered gaps; `coverage_complete` remains false, so it is never labelled a complete role-training timeline. A no-gap profile is a separate zero-additional-learning state.

## Enhancement scoring audit

The full 15-role / three-profile audit is in [SCORING_AUDIT.md](SCORING_AUDIT.md), with raw JSON and a reproducible script. Complete essential requirements and the unknown type remain accounted for. The import has no reviewed competency-domain assignments. A type-balanced diagnostic was evaluated and rejected; skill/knowledge are types, not domains. `competency_alignment_pct` therefore remains null. Old scores remain identical for original profile-role pairs. New candidates can change ranks.

The UI now says Documented essential coverage, shows up to three strengths and priority gaps, and exposes types and full searchable requirements behind disclosures. Priority gaps use reviewed resource mappings first, then alphabetical label/canonical ID; this is a presentation rule, not ESCO importance. Actual prerequisites, eligibility and budget are checked when constructing the pathway. The ranking formula remains exact essential coverage only.

## Market evidence, SDGs and scenarios

Market context never changes personal coverage or its rank. Fixtures A/B compare 20-day September/October windows with fictional counts 8 -> 12 and 8 -> 5. They are visibly synthetic. No genuine updatable market source, Malaysian demand claim, salary forecast or job-growth statistic is shipped. Real trend refresh, SDG reasons for every final role/skill and defined moderate/fast scenarios remain external integration requirements.

## Privacy and runtime

No real CV, authentication, profile storage, demographics-based scoring, LLM, GPU, payment service or third-party recommendation API. API requests contain synthetic profile data. Reference data are local and versioned; link checking/import scripts run only when explicitly invoked. Standard web-server access logs contain paths/statuses, not profile bodies. The existing frontend font import makes an optional Google Fonts request; Arial fallback works without it. Outgoing font requests carry normal browser/network metadata. Do not claim production privacy/security assessment or measured employment impact.
