"""Render the actual scoring audit and reviewed catalogue inventory as Markdown."""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.services.future_roles.data_repository import load_catalogues


def write_reports():
    b = load_catalogues()
    audit = json.loads((ROOT / 'docs/scoring-audit.json').read_text())
    baseline = json.loads((ROOT / 'docs/scoring-audit-baseline.json').read_text())
    lines = ['# Scoring audit and decision - 21 October 2026', '',
        'Audit code: `scripts/audit_scoring.py`. All values below are calculated from the committed ESCO v1.2.1 dataset and three synthetic profiles. Raw results: `scoring-audit-baseline.json` (five roles, before edits) and `scoring-audit.json` (15 roles).', '',
        '## Decision', '',
        'Retain `essential-skill-coverage-v1`: `100 * matched essential canonical IDs / all essential canonical IDs`. Exact fractions determine ranking, then canonical role URI breaks ties. Display label is now **Documented essential coverage**. `personal_fit_score_pct` retains its original meaning; `essential_concept_coverage_pct` is an additive alias, not a new formula. `competency_alignment_pct` remains null.', '',
        'The import is a version-pinned occupation API subset, not a downloaded full hierarchy package. Every role has complete essential/optional arrays, a released native record, provenance and recorded raw-response SHA256/counts. Pydantic rejects duplicate canonical requirement URIs. Records are not deduplicated by label. All original essential counts were reproduced after expansion.', '',
        'ESCO documents skill/competence and knowledge types ([official classification](https://esco.ec.europa.eu/en/classification)). These are **not** competency domains. The reviewed import contains no broader-skill graph or mutually exclusive domain assignments. One AI-engineer essential relationship omits its type; it stays unknown and remains in the denominator.', '',
        'A diagnostic alternative gives equal weight to each nonempty skill-type group: `100 * mean(matched_in_type / total_in_type)`, including unknown. It is NOT used in API scores, rankings or UI. It gives Profile A / AI engineer 3.51% versus strict 6.45%, partly because the unknown-type requirement forms a group. Dropping it would hide evidence; weighting these coarse types as domains is unjustified. No alternative is tuned to increase scores.', '',
        '## Exact aliases and generic terms', '',
        'The reviewed application aliases are Python -> Python (computer programming), JS -> JavaScript, programming -> computer programming, Structured Query Language -> SQL; case-insensitive exact matching and canonical deduplication apply. They are application-reviewed aliases, not a claim of imported full ESCO non-preferred terms. Generic HTML is not silently mapped to use markup languages; CSS does not count as having every style-sheet-language skill. Related concepts are not interchangeable. No unrestricted semantic matching was introduced.', '',
        '## Original five roles: before / after strict scores', '',
        '| Synthetic profile | Occupation | Before | After | Type-balanced diagnostic (rejected) |',
        '|---|---|---:|---:|---:|']
    current = {(r['profile_id'], r['role_id']): r for r in audit['comparisons']}
    for r in baseline['comparisons']:
        after = current[r['profile_id'], r['role_id']]
        lines.append(f"| {r['profile_id']} | {r['role_title']} | {r['strict_coverage_pct']:.2f}% | {after['strict_coverage_pct']:.2f}% | {after['diagnostic_type_balanced_pct']:.2f}% |")
    lines += ['', '## Complete requirement counts in the actual expanded catalogue', '',
        '| Occupation | Essential | Skill/competence | Knowledge | Unknown | Optional |', '|---|---:|---:|---:|---:|---:|']
    for r in audit['roles']:
        t = r['essential_types']
        lines.append(f"| {r['title']} | {r['essential_count']} | {t.get('skill', 0)} | {t.get('knowledge', 0)} | {t.get('unknown', 0)} | {r['optional_count']} |")
    lines += ['', '## All candidate roles across all three profiles', '',
        '| Profile | Role | Rank | Strict (adopted) | Type-balanced diagnostic (rejected) |', '|---|---|---:|---:|---:|']
    for r in audit['comparisons']:
        lines.append(f"| {r['profile_id']} | {r['role_title']} | {r['rank']} | {r['strict_coverage_pct']:.2f}% | {r['diagnostic_type_balanced_pct']:.2f}% |")
    lines += ['', f"Three-profile local matching audit: {audit['three_profile_matching_ms']} ms in the recorded run (not a load test or latency SLA).", '',
        'Ranks change when new candidates enter the shortlist, while original profile-role fractions remain identical. Profile B now ranks ICT application developer (2/17 = 11.76%) before web developer (3/26 = 11.54%); this is a catalogue change, not score inflation. A/C rankings and all 45 comparisons are recorded above. Sparse profiles legitimately have zero-overlap roles, whose gaps remain visible.', '',
        '## Decision needed only for a future second score', '',
        'Proposal: obtain the version-matched ESCO broader-skill graph, review a named domain mapping for every essential URI, resolve multiple parents by an explicit rule, retain Other documented requirements for unresolved cases, and review the equal-domain weighting and rank changes across all profiles before adopting it. Approval of that mapping/method is needed before presenting a competency-alignment score. Until then the requested safe fallback is implemented; this does not block the UI, resources or estimates.', '']
    (ROOT / 'docs/SCORING_AUDIT.md').write_text('\n'.join(lines), encoding='utf-8')
    original_ids = {r['role_id'] for r in baseline['roles']}
    lines = ['# Reviewed catalogue inventory - 21 October 2026', '',
        f"**{len(b.occupations.occupations)} occupations; {len(b.occupations.skills)} unique canonical concepts; {len(b.resources.resources)} reviewed resources.** Ten occupations and fourteen resources were added. All original native IDs/requirements and eight resources remain. Shortlist selection is project editorial scope, not proof of future demand or graduate entry requirements.", '',
        '## Official ESCO v1.2.1 occupations', '',
        'All 15 official API records were retrieved and checked for native URI/title, released status, complete essential/optional arrays and duplicate canonical IDs. URLs, dates and raw-response hashes are in `data/sources/esco_sources.json` and `esco_verification_log.json`. No full-package download is claimed. ESCO attribution/reuse conditions remain in `DATA_SOURCES_AND_LICENSES.md`.', '',
        '| Status | Official title and record | Essential | Optional |', '|---|---|---:|---:|']
    for r in b.occupations.occupations:
        url = b.sources[r.source_ids[0]].url
        lines.append(f"| {'Existing' if r.role_id in original_ids else 'Added'} | [{r.title}]({url}) | {r.expected_essential_count} | {sum(x.requirement == 'optional' for x in r.required_skills)} |")
    lines += ['', '## Individually reviewed learning resources', '',
        'Provider titles, curricula/objectives, prerequisite text, published durations and free-content boundaries were inspected. Mapping rationales are editorial partial-learning interpretations, not provider certification of ESCO mastery. All content/access URLs also returned HTTP 200 in a separate check; availability alone is not content verification. Original eight resources are marked existing.', '',
        '| Status | Actual provider resource | Type | Published estimate | Planning scope | Partial mapping rationale |', '|---|---|---|---|---|---|']
    for i, r in enumerate(b.resources.resources):
        value = f"{round(r.duration_hours * 60)} min" if r.duration_hours is not None else 'Not published in hours'
        lines.append(f"| {'Existing' if i < 8 else 'Added'} | [{r.title}]({r.url}) - {r.provider} | {r.resource_type} | {value} | {r.planning_scope} | {r.coverage_note} |")
    lines += ['', '## Limits and access', '',
        'The ten course entries are eight bounded Google modules and two full Harvard CS50 OpenCourseWare courses. Articles/tutorials/docs are labelled separately. CS50 SQL has seven curriculum weeks and a final project; CS50 Python has ten units and a final project. Neither is compressed into the one-week fallback, and curriculum week labels are not treated as verified total study hours. Python tutorial/pdb and the multipart PostgreSQL tutorial retain unknown whole-resource time.', '',
        'Free refers to linked reading/learning content. Credentials, submissions/feedback requiring accounts, hosted services and Malaysian regional sign-up are not fully tested or promised. PostgreSQL practice requires a local environment and permissions; Git requires setup. Long provider prerequisite caveats remain available in Details and evidence. Some prerequisites remain human checks rather than assessed knowledge.', '',
        'Provider links are stored, with original project metadata and no mirrored course content/images. Pro Git identifies CC BY-NC-SA 3.0 content; PostgreSQL publishes its own software/documentation licence; Harvard CS50 retains its own OpenCourseWare/certificate terms. Existing Google/MDN/Python/Microsoft notices are preserved.', '',
        'Several newly included roles, especially green ICT consulting and help-desk work, still have no mapped learning material. They remain real scored occupations with explicit uncovered pathways; no courses were fabricated to meet an arbitrary coverage target.', '']
    (ROOT / 'docs/CATALOGUE_REVIEW.md').write_text('\n'.join(lines), encoding='utf-8')
    print('Wrote SCORING_AUDIT.md and CATALOGUE_REVIEW.md from actual catalogues/audits.')


if __name__ == '__main__':
    write_reports()
