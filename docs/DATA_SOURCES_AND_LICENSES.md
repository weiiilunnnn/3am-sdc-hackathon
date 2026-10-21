# Current full-index source addition

This service uses the ESCO classification of the European Commission. The full local discovery index was built explicitly from complete official occupation/skill bulk API collections, requested version v1.2.1, English, released records: 3,658 occupations, 14,579 concepts, 67,600 essential and 58,451 optional edges. No orphan/duplicate relations or import anomalies were found. Original 15-role relationship sets were checked as anchors; the small subset remains for legacy/offline use.

`data/index/esco_v1.2.1_en.json.gz` is the compressed derived artifact. Its `.json.manifest.json` records the SHA256, import version, all page URLs/retrieval dates/hashes, exact upstream/unique counts, version assurance and attribution. `api-compatibility.json` records executed probes: explicit v1.2.1 accepted, invalid version rejected, returned_version absent. The website's published API list lags this observed support; no unreported returned release is invented and no different-release records are merged into scoring.

The source is the documented official API, not a full CSV package download. No email/privacy flow was scraped and no machine download URL was guessed. English extraction and official alternative labels, canonical broader-skill/reuse metadata and relationship classifications are preserved. App IDF/threshold/group-display rules are separate editorial transformations. Existing European Commission reuse/attribution conditions remain; no endorsement or Malaysian-market inference is implied. Raw bulk responses are ignored local build caches, not a runtime network dependency. No learning/provider catalogue content was changed by this Feature 3 request.

Full details and exact file/source manifests: FUTURE_ROLE_IMPLEMENTATION.md. The earlier source inventory below remains relevant to the built-in subset and unchanged reskilling catalogue.

---

# Data sources, rights and verification

## ESCO reference data

This service uses the ESCO classification of the European Commission.

The committed English subset uses ESCO **v1.2.1**, explicitly requested via the official API. It contains 15 released occupations, **485 distinct linked concepts**, and all essential/optional links for those occupations. See `data/occupations/esco_v1.2.1_en.json`, `data/sources/esco_sources.json` and `esco_verification_log.json`. The log records each retrieval URL, date, response SHA-256 and original relationship counts. One relation did not provide a concept type; it is retained as unknown.

[Official downloads](https://esco.ec.europa.eu/en/use-esco/download), [API](https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api), [content reuse conditions](https://esco.ec.europa.eu/en/about-esco/faq?page=1).

Content reuse follows the European Commission's reuse conditions cited by ESCO (2011/833/EU), with the acknowledgement above and disclosure of changes. It is not automatically covered by this repository's Apache code licence. API software licensing is distinct from classification content reuse. Project changes: English extraction, local JSON structure, reviewed aliases, coverage calculations and editorial learning mappings. They are not European Commission endorsements. Canonical IDs and essential/optional semantics are unchanged. EU occupational data do not establish Malaysian hiring demand.

O*NET 31.0 (August 2026) was evaluated but is not integrated. Its downloadable database is CC BY 4.0 with version-specific attribution; its skill categories/scales would need an explicit adapter. [Release archive](https://www.onetcenter.org/db_releases.html), [licence](https://www.onetcenter.org/license_db.html).

## Learning catalogue

Provider titles, curricula, prerequisites and durations were reviewed on **21 October 2026**. Entries contain exact links, source IDs, reviewed canonical mappings, coverage notes, access/cost limits and verification dates. Syllabus mappings are project interpretations of partial/introductory coverage; no provider claims a course alone establishes an occupation's competency.

| Provider material | Published estimated duration | Mapping / access boundary |
|---|---:|---|
| Google Introduction to ML | 20 min | Concept prerequisite; not implementation training |
| Google Linear Regression | 80 min | Partial mathematical/statistical modelling |
| Google Logistic Regression | 35 min | Partial statistical modelling |
| Google Classification | 70 min | Partial model evaluation; explicit earlier modules |
| Microsoft Explore SQL | 10 min | Introductory SQL/query-language knowledge |
| Python 3.13 Tutorial | Unknown | Assumes general programming knowledge |
| Python 3.13 pdb documentation | Unknown | Python-specific debugging/tools |
| MDN JavaScript troubleshooting | Unknown | Requires HTML/CSS/JavaScript familiarity |

Exact URLs and content/access-policy citations are in `learning_sources.json`. `learning_verification_log.json` records reviewed mappings and their limits. `link_check_log.json` records independent HTTP availability checks; HTTP 200 alone does not establish content, price or skill coverage. No course content or third-party images are mirrored. Provider licence fields remain null where no item-specific redistribution licence was established; we link rather than redistribute. Google's pages disclose CC BY 4.0 text / Apache 2.0 code samples; Python documentation discloses PSF v2 / 0BSD for examples. Those notices are not applied to other providers.

Free means the linked learning content, excluding credentials, optional cloud provisioning, partner subscriptions and third-party courses. Account-based exercises and Malaysian region access have not been fully tested. The Microsoft parent path's earlier 1 hr 19 min claim was not reproduced and is not used. freeCodeCamp's curriculum could not be inspected adequately and is excluded.

## Expanded catalogue and scope review

[CATALOGUE_REVIEW.md](CATALOGUE_REVIEW.md) lists all 15 occupations and 22 resource entries, exact provider links, published minutes, planning scopes and partial mapping rationales. Ten occupations and fourteen resources were added after the enhancement request. All original ESCO native IDs and complete relationship counts remain; the dataset ID is now `esco-tech-shortlist`, still version v1.2.1. No full ESCO package import or hierarchy mapping is claimed.

New materials include four Google MLCC modules (85, 50, 105 and 75 provider minutes), MDN HTML/CSS/JavaScript/responsive units, PostgreSQL SQL/backup documentation, two Pro Git sections and Harvard CS50 SQL/Python OpenCourseWare. There are eight bounded Google course modules and two large CS50 courses. The one-week app rule is not applied to the large CS50 programmes. Scopes and mapping/prerequisite review notes are preserved in the catalogue/log.

Pro Git's linked book identifies CC BY-NC-SA 3.0 content; PostgreSQL's own licence covers its documentation; Harvard retains its own OpenCourseWare terms. This project stores links and original editorial descriptions, not their course text or images. The independent access check covered 29 source entries, including shared policy/content URLs; all returned HTTP 200. Scope-aware syllabus review remains distinct from those availability checks.

## Synthetic and absent evidence

Three personas and trend snapshots A/B are fictional. Their registry source has `evidence_status=synthetic`, no real evidence URL and `test_fixture_only`. Fictional course/occupation entries exist only in unit test code and never the shipped factual catalogues. Adzuna is not integrated; no access credentials/tier/Malaysia coverage was assumed. No SDG impact baseline, forecast accuracy, employment improvement or actual sponsor-cloud usage is claimed.

## Software inventory

Application code uses the repository's Apache 2.0 licence. Tested direct versions: Python 3.12.14; FastAPI 0.156.4 (MIT); Uvicorn 0.54.0 (BSD-3-Clause); Pydantic 2.14.1 (MIT); httpx 0.28.1 (BSD-3-Clause, tests); Next.js 16.4.2 / React and React DOM 19.3.1 (MIT); TypeScript 7.0.2 (Apache-2.0). Playwright test version is pinned in `src/frontend/package.json` / lockfile (Apache-2.0). Retain installed packages' own licence notices. Existing RunPod dependency/echo handler is preserved, but these features do not call it and do not establish RunPod deployment/use. Frontend Google Fonts usage is inherited; the application works with fallback system fonts.

Playwright 1.64.1 (Apache-2.0) and RunPod SDK 1.12.0 (MIT) were also installed and pinned; installing the SDK is not evidence of a cloud workload. Exact Node dependency tree: committed package lock. Backend direct dependencies: `requirements.txt`; test dependencies: `requirements-dev.txt`. The project uses Codex-assisted development with developer review, automated tests and browser verification; declaration authors should record the actual tool/model information available to them, without inferring a runtime model integration.
