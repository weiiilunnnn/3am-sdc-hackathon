# Scoring audit and decision - 21 October 2026

Audit code: `scripts/audit_scoring.py`. All values below are calculated from the committed ESCO v1.2.1 dataset and three synthetic profiles. Raw results: `scoring-audit-baseline.json` (five roles, before edits) and `scoring-audit.json` (15 roles).

## Decision

Retain `essential-skill-coverage-v1`: `100 * matched essential canonical IDs / all essential canonical IDs`. Exact fractions determine ranking, then canonical role URI breaks ties. Display label is now **Documented essential coverage**. `personal_fit_score_pct` retains its original meaning; `essential_concept_coverage_pct` is an additive alias, not a new formula. `competency_alignment_pct` remains null.

The import is a version-pinned occupation API subset, not a downloaded full hierarchy package. Every role has complete essential/optional arrays, a released native record, provenance and recorded raw-response SHA256/counts. Pydantic rejects duplicate canonical requirement URIs. Records are not deduplicated by label. All original essential counts were reproduced after expansion.

ESCO documents skill/competence and knowledge types ([official classification](https://esco.ec.europa.eu/en/classification)). These are **not** competency domains. The reviewed import contains no broader-skill graph or mutually exclusive domain assignments. One AI-engineer essential relationship omits its type; it stays unknown and remains in the denominator.

A diagnostic alternative gives equal weight to each nonempty skill-type group: `100 * mean(matched_in_type / total_in_type)`, including unknown. It is NOT used in API scores, rankings or UI. It gives Profile A / AI engineer 3.51% versus strict 6.45%, partly because the unknown-type requirement forms a group. Dropping it would hide evidence; weighting these coarse types as domains is unjustified. No alternative is tuned to increase scores.

## Exact aliases and generic terms

The reviewed application aliases are Python -> Python (computer programming), JS -> JavaScript, programming -> computer programming, Structured Query Language -> SQL; case-insensitive exact matching and canonical deduplication apply. They are application-reviewed aliases, not a claim of imported full ESCO non-preferred terms. Generic HTML is not silently mapped to use markup languages; CSS does not count as having every style-sheet-language skill. Related concepts are not interchangeable. No unrestricted semantic matching was introduced.

## Original five roles: before / after strict scores

| Synthetic profile | Occupation | Before | After | Type-balanced diagnostic (rejected) |
|---|---|---:|---:|---:|
| demo-graduate-a | artificial intelligence engineer | 6.45% | 6.45% | 3.51% |
| demo-graduate-a | database developer | 5.00% | 5.00% | 3.85% |
| demo-graduate-a | data scientist | 4.76% | 4.76% | 6.67% |
| demo-graduate-a | web developer | 0.00% | 0.00% | 0.00% |
| demo-graduate-a | software developer | 0.00% | 0.00% | 0.00% |
| demo-graduate-b | web developer | 11.54% | 11.54% | 11.90% |
| demo-graduate-b | software developer | 8.33% | 8.33% | 8.89% |
| demo-graduate-b | artificial intelligence engineer | 3.23% | 3.23% | 1.75% |
| demo-graduate-b | data scientist | 0.00% | 0.00% | 0.00% |
| demo-graduate-b | database developer | 0.00% | 0.00% | 0.00% |
| demo-graduate-c | software developer | 4.17% | 4.17% | 5.56% |
| demo-graduate-c | web developer | 3.85% | 3.85% | 4.17% |
| demo-graduate-c | artificial intelligence engineer | 3.23% | 3.23% | 1.75% |
| demo-graduate-c | data scientist | 0.00% | 0.00% | 0.00% |
| demo-graduate-c | database developer | 0.00% | 0.00% | 0.00% |

## Complete requirement counts in the actual expanded catalogue

| Occupation | Essential | Skill/competence | Knowledge | Unknown | Optional |
|---|---:|---:|---:|---:|---:|
| software developer | 24 | 15 | 9 | 0 | 84 |
| data scientist | 63 | 45 | 18 | 0 | 34 |
| web developer | 26 | 14 | 12 | 0 | 77 |
| artificial intelligence engineer | 31 | 11 | 19 | 1 | 58 |
| database developer | 20 | 13 | 7 | 0 | 96 |
| ICT application developer | 17 | 13 | 4 | 0 | 74 |
| ICT system developer | 20 | 13 | 7 | 0 | 77 |
| ICT system tester | 12 | 9 | 3 | 0 | 30 |
| ICT test analyst | 9 | 8 | 1 | 0 | 27 |
| ICT system analyst | 28 | 18 | 10 | 0 | 69 |
| ICT business analyst | 18 | 13 | 5 | 0 | 19 |
| ICT network technician | 20 | 15 | 5 | 0 | 19 |
| ICT security technician | 34 | 19 | 15 | 0 | 61 |
| ICT help desk agent | 20 | 16 | 4 | 0 | 12 |
| green ICT consultant | 14 | 9 | 5 | 0 | 13 |

## All candidate roles across all three profiles

| Profile | Role | Rank | Strict (adopted) | Type-balanced diagnostic (rejected) |
|---|---|---:|---:|---:|
| demo-graduate-a | artificial intelligence engineer | 1 | 6.45% | 3.51% |
| demo-graduate-a | database developer | 2 | 5.00% | 3.85% |
| demo-graduate-a | data scientist | 3 | 4.76% | 6.67% |
| demo-graduate-a | ICT test analyst | 4 | 0.00% | 0.00% |
| demo-graduate-a | green ICT consultant | 5 | 0.00% | 0.00% |
| demo-graduate-a | ICT system tester | 6 | 0.00% | 0.00% |
| demo-graduate-a | ICT network technician | 7 | 0.00% | 0.00% |
| demo-graduate-a | ICT security technician | 8 | 0.00% | 0.00% |
| demo-graduate-a | ICT system analyst | 9 | 0.00% | 0.00% |
| demo-graduate-a | ICT system developer | 10 | 0.00% | 0.00% |
| demo-graduate-a | ICT help desk agent | 11 | 0.00% | 0.00% |
| demo-graduate-a | ICT application developer | 12 | 0.00% | 0.00% |
| demo-graduate-a | web developer | 13 | 0.00% | 0.00% |
| demo-graduate-a | software developer | 14 | 0.00% | 0.00% |
| demo-graduate-a | ICT business analyst | 15 | 0.00% | 0.00% |
| demo-graduate-b | ICT application developer | 1 | 11.76% | 16.35% |
| demo-graduate-b | web developer | 2 | 11.54% | 11.90% |
| demo-graduate-b | ICT system developer | 3 | 10.00% | 10.99% |
| demo-graduate-b | software developer | 4 | 8.33% | 8.89% |
| demo-graduate-b | artificial intelligence engineer | 5 | 3.23% | 1.75% |
| demo-graduate-b | ICT test analyst | 6 | 0.00% | 0.00% |
| demo-graduate-b | green ICT consultant | 7 | 0.00% | 0.00% |
| demo-graduate-b | data scientist | 8 | 0.00% | 0.00% |
| demo-graduate-b | ICT system tester | 9 | 0.00% | 0.00% |
| demo-graduate-b | ICT network technician | 10 | 0.00% | 0.00% |
| demo-graduate-b | ICT security technician | 11 | 0.00% | 0.00% |
| demo-graduate-b | ICT system analyst | 12 | 0.00% | 0.00% |
| demo-graduate-b | ICT help desk agent | 13 | 0.00% | 0.00% |
| demo-graduate-b | database developer | 14 | 0.00% | 0.00% |
| demo-graduate-b | ICT business analyst | 15 | 0.00% | 0.00% |
| demo-graduate-c | ICT application developer | 1 | 5.88% | 12.50% |
| demo-graduate-c | ICT system developer | 2 | 5.00% | 7.14% |
| demo-graduate-c | software developer | 3 | 4.17% | 5.56% |
| demo-graduate-c | web developer | 4 | 3.85% | 4.17% |
| demo-graduate-c | artificial intelligence engineer | 5 | 3.23% | 1.75% |
| demo-graduate-c | ICT test analyst | 6 | 0.00% | 0.00% |
| demo-graduate-c | green ICT consultant | 7 | 0.00% | 0.00% |
| demo-graduate-c | data scientist | 8 | 0.00% | 0.00% |
| demo-graduate-c | ICT system tester | 9 | 0.00% | 0.00% |
| demo-graduate-c | ICT network technician | 10 | 0.00% | 0.00% |
| demo-graduate-c | ICT security technician | 11 | 0.00% | 0.00% |
| demo-graduate-c | ICT system analyst | 12 | 0.00% | 0.00% |
| demo-graduate-c | ICT help desk agent | 13 | 0.00% | 0.00% |
| demo-graduate-c | database developer | 14 | 0.00% | 0.00% |
| demo-graduate-c | ICT business analyst | 15 | 0.00% | 0.00% |

Three-profile local matching audit: 17.268 ms in the recorded run (not a load test or latency SLA).

Ranks change when new candidates enter the shortlist, while original profile-role fractions remain identical. Profile B now ranks ICT application developer (2/17 = 11.76%) before web developer (3/26 = 11.54%); this is a catalogue change, not score inflation. A/C rankings and all 45 comparisons are recorded above. Sparse profiles legitimately have zero-overlap roles, whose gaps remain visible.

## Decision needed only for a future second score

Proposal: obtain the version-matched ESCO broader-skill graph, review a named domain mapping for every essential URI, resolve multiple parents by an explicit rule, retain Other documented requirements for unresolved cases, and review the equal-domain weighting and rank changes across all profiles before adopting it. Approval of that mapping/method is needed before presenting a competency-alignment score. Until then the requested safe fallback is implemented; this does not block the UI, resources or estimates.
