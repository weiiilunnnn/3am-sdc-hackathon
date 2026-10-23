"""Materialise the provider pages and syllabus mappings reviewed on 21 Oct 2026.

Editorial mappings are partial learning support, never a competency guarantee.
Re-run after reviewing provider changes, then run scripts/check_source_links.py.
"""
import json
from pathlib import Path
from learning_additions import ADDITIONS

ROOT = Path(__file__).resolve().parents[1]
CHECKED = "2026-10-21"


def write(path, obj):
    path = ROOT / path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def curate():
    catalog = json.loads((ROOT / "data/occupations/esco_v1.2.1_en.json").read_text(encoding="utf-8"))
    by_name = {s["name"]: s["skill_id"] for s in catalog["skills"]}
    def ids(names):
        return [by_name[name] for name in names]
    # All targets are native concepts in the approved source subset.
    specifications = [
        ("google-intro-ml", "Introduction to Machine Learning", "Google", "https://developers.google.com/machine-learning/intro-to-ml", "course", [], 20, [], [],
         "Conceptual prerequisite only; does not teach implementing ML or working with data.", "No prior ML concepts assumed."),
        ("google-linear-regression", "Linear regression", "Google", "https://developers.google.com/machine-learning/crash-course/linear-regression", "course", ["statistical modeling techniques", "mathematical modelling"], 80, ["google-intro-ml"], [],
         "Introduction to linear models, loss, gradient descent and hyperparameter tuning; partial coverage of modelling concepts.", "Provider MLCC prework recommends programming, algebra and statistics; complete prerequisite checks before exercises."),
        ("google-logistic-regression", "Logistic regression", "Google", "https://developers.google.com/machine-learning/crash-course/logistic-regression", "course", ["statistical modeling techniques"], 35, ["google-intro-ml", "google-linear-regression"], [],
         "Introduction to logistic models, sigmoid and regularisation; partial modelling coverage.", "Familiarity with introductory ML and linear regression is required."),
        ("google-classification", "Classification", "Google", "https://developers.google.com/machine-learning/crash-course/classification", "course", ["statistical modeling techniques"], 70, ["google-intro-ml", "google-linear-regression", "google-logistic-regression"], [],
         "Classification thresholds, metrics, ROC and AUC; partial modelling coverage.", "Provider lists introductory ML, linear regression and logistic regression as prerequisites."),
        ("microsoft-explore-sql", "Explore SQL", "Microsoft Learn", "https://learn.microsoft.com/en-us/training/modules/explore-relational-data-offerings/4-query-with-sql", "article", ["SQL", "query languages"], 10, [], [],
         "Introduces SQL statement types and examples. Introductory query-language knowledge, not complete database development training.", "Parent module lists no prerequisites."),
        ("python-tutorial", "The Python Tutorial", "Python Software Foundation", "https://docs.python.org/3.13/tutorial/", "tutorial", ["Python (computer programming)"], None, [], ["computer programming"],
         "Python language constructs, functions, data structures and modules; assumes general programming knowledge.", "Provider explicitly targets programmers new to Python, not people new to programming."),
        ("python-debugger", "pdb - The Python Debugger", "Python Software Foundation", "https://docs.python.org/3.13/library/pdb.html", "documentation", ["debug software", "ICT debugging tools"], None, [], ["Python (computer programming)"],
         "Python-specific breakpoints, stepping, stack inspection and post-mortem debugging; partial software-debugging coverage.", "Reading Python examples requires Python familiarity."),
        ("mdn-js-debugging", "What went wrong? Troubleshooting JavaScript", "MDN Web Docs", "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/What_went_wrong", "article", ["debug software", "ICT debugging tools"], None, [], ["CSS", "JavaScript"],
         "JavaScript error types, console logging and browser DevTools; partial software-debugging coverage.", "Provider also requires HTML knowledge. Confirm this before attempting the article; HTML is outside this catalogue's linked concepts."),
    ]
    specifications += ADDITIONS
    sources, resources, checks = [], [], []
    policy_pages = {
        "Google": "https://blog.google/innovation-and-ai/technology/developers-tools/machine-learning-crash-course/",
        "Microsoft Learn": "https://learn.microsoft.com/en-us/training/support/faq",
        "Python Software Foundation": "https://docs.python.org/3.13/copyright.html",
        "MDN Web Docs": "https://developer.mozilla.org/en-US/curriculum/",
        "PostgreSQL Global Development Group": "https://www.postgresql.org/about/licence/",
        "Pro Git": "https://git-scm.com/book/en/v2",
        "Harvard CS50": "https://cs50.harvard.edu/sql/",
    }
    for rid, title, provider, url, kind, names, minutes, deps, skilldeps, coverage, notes in specifications:
        sid = "learning:" + rid
        sources.append({"source_id": sid, "evidence_status": "verified", "source_type": "provider_course_page" if kind == "course" else "provider_article_page",
            "title": title, "publisher": provider, "url": url, "license": None,
            "dataset_version": "catalog-v1", "native_record_id": url, "accessed_at": CHECKED,
            "region": "global", "supported_claims": ["resource_content", "skill_mapping"] + (["duration"] if minutes is not None else []) + (["free_access"] if rid in {"cs50-sql", "cs50-python"} else []),
            "redistribution_notes": "Store links and original editorial metadata only; do not mirror course content.",
            "transformations": "Syllabus-to-ESCO mapping reviewed by project; partial learning coverage, no provider endorsement."})
        policy_id = "access:" + provider
        if not any(s["source_id"] == policy_id for s in sources):
            sources.append({"source_id": policy_id, "evidence_status": "verified", "source_type": "provider_access_policy", "title": provider + " public learning access",
                "publisher": provider, "url": policy_pages[provider], "accessed_at": CHECKED, "region": "global",
                "supported_claims": ["free_access"], "redistribution_notes": "Link only; credentials, cloud services and partner products excluded."})
        large = rid in {"python-tutorial", "python-debugger", "postgres-sql", "cs50-sql", "cs50-python"}
        scope = "large_collection" if large else "bounded_course" if kind == "course" else "short_unit"
        resources.append({"resource_id": rid, "title": title, "provider": provider, "url": url,
            "resource_type": kind, "covers_skill_ids": ids(names), "prerequisite_skill_ids": ids(skilldeps),
            "prerequisite_resource_ids": deps, "prerequisite_notes": notes,
            "duration_hours": minutes / 60 if minutes is not None else None,
            "duration_basis": "provider_stated" if minutes is not None else "unknown",
            "planning_scope": scope,
            "scope_review_note": "Reviewed multipart scope; simple fallback would understate material." if large else "Reviewed discrete module or single reading/tutorial page; fallback eligible if no provider duration.",
            "cost_status": "free", "cost": {"amount": 0, "currency": "MYR"},
            "access_verified_at": CHECKED, "source_ids": [sid, policy_id], "evidence_status": "verified",
            "coverage_note": coverage, "access_notes": "Public reading material; no paid credential or cloud provisioning required. Exercises/sign-in and Malaysian regional access not fully tested."})
        checks.append({"source_id": sid, "checked_at": CHECKED,
            "method": "Provider page text reviewed: title, objectives, prerequisites and published duration where shown; exact ESCO concepts mapped editorially.",
            "duration_minutes": minutes, "mapped_skill_ids": ids(names), "coverage": "introductory/partial",
            "mapping_review_note": coverage, "scope": scope, "prerequisite_review": notes,
            "access_review": "Linked content is publicly readable; see access policy and prerequisite/account caveats. CS50 course pages each explicitly offer free OpenCourseWare; paid credentials are separate.",
            "limits": "No claim that this resource alone establishes the occupational skill. Account-based exercises not executed."})
    write("data/resources/catalog_v1.json", {"schema_version": "1.1", "catalog_version": "1.1", "resources": resources})
    write("data/sources/learning_sources.json", {"schema_version": "1.0", "sources": sources})
    write("data/sources/learning_verification_log.json", {"schema_version": "1.0", "checks": checks})
    demo_source = {"source_id": "demo:fixture:001", "evidence_status": "synthetic", "source_type": "synthetic_fixture",
        "title": "Synthetic integration fixtures - not market observations", "publisher": "3AM demo data", "url": None,
        "region": "unspecified", "dataset_version": "demo-v1", "supported_claims": ["test_fixture_only"]}
    write("data/sources/demo_sources.json", {"schema_version": "1.0", "sources": [demo_source]})
    profiles = []
    personas = [
        ("demo-graduate-a", "Synthetic Graduate A - data foundations", ["Python (computer programming)", "SQL", "statistics", "use databases", "data models"], 8),
        ("demo-graduate-b", "Synthetic Graduate B - web foundations", ["computer programming", "JavaScript", "CSS", "web programming", "debug software"], 4),
        ("demo-graduate-c", "Synthetic Graduate C - exploring technology", ["computer programming"], 2),
    ]
    for pid, education, names, hours in personas:
        profiles.append({"schema_version": "1.0", "profile_id": pid, "is_synthetic": True, "education": education,
            "experience_years": 0, "skills": [{"skill_id": by_name[n], "name": n, "proficiency": "beginner", "self_reported": True} for n in names],
            "interests": [], "learning_preferences": {"hours_per_week": hours, "budget": {"amount": 0, "currency": "MYR"}, "preferred_resource_types": ["course", "article", "tutorial", "documentation"]}})
    write("data/demo/profiles.json", {"schema_version": "1.0", "profiles": profiles})
    for suffix, count in [("a", 12), ("b", 5)]:
        signals = []
        for i, role in enumerate(catalog["occupations"]):
            signals.append({"signal_id": f"demo:signal:{suffix}:{i}", "scope": "role", "role_id": role["role_id"], "skill_id": None,
                "region": "unspecified", "metric": "synthetic_posting_count", "unit": "count",
                "period_previous": {"start": "2026-09-01", "end": "2026-09-20", "value": 8},
                "period_current": {"start": "2026-10-01", "end": "2026-10-20", "value": count},
                "direction": "rising" if count > 8 else "declining", "direction_origin": "calculated",
                "derivation_rule": "Synthetic count comparison only: current greater/equal/lower than previous.",
                "comparison_method": "count_comparison_v1", "comparability_confirmed": True, "source_ids": [demo_source["source_id"]]})
        write(f"data/demo/trend_{suffix}.json", {"schema_version": "1.0", "snapshot_id": f"demo-trend-{suffix}", "is_synthetic": True,
            "collected_at": "2026-10-21T09:00:00+08:00", "source_ids": [demo_source["source_id"]], "signals": signals,
            "refresh_method": "Manually switch synthetic fixture A/B; not a real source refresh."})
    print(f"Wrote {len(resources)} reviewed resources, {len(profiles)} synthetic profiles and two synthetic snapshots.")


if __name__ == "__main__":
    curate()
