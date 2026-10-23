# Features 1–2: profile intake, research signals and employment snapshots

This prototype implements only Skills Profile Intake and the AI-Trend Signal
Layer. Career matching, reskilling recommendations, SDG mapping, and future
scenarios remain out of scope.

## Skills Profile Intake

- Profiles are accepted only with `synthetic_demo: true`; the web form requires
  the user to confirm that the information is fictional.
- Do not enter real CVs, names, contact details, or other personal information.
  PDF/DOCX upload is limited to fictional demonstrations. The file is processed
  in memory and is not saved by the extraction API. The confirmation is a
  demo-policy control, not automated personal-information detection.
- Profile create, read, and update data is stored in SQLite. By default the
  database is `src/data/future_ready.sqlite3`; set `APP_DB_PATH` to use another
  location. SQLite database files are excluded from Git.
- Skills selected or reviewed during registration use canonical ESCO v1.2.1
  skill IDs from the verified English snapshot. Legacy profile entries can
  still use stable `local:` identifiers. Unknown skills are kept as custom
  entries without an identifier rather than being silently mapped to a known
  concept. Duplicate known skills are merged; the highest supplied proficiency
  is retained and the original labels are preserved.
- Two fictional sample profiles are available from
  `GET /api/profiles/samples`; loading a sample in the UI does not save it until
  the user submits the form.
- Comma-list inputs retain unfinished separators while typing and normalize
  lists for submission. The API rejects blank or over-120-character list entries.
- A temporary saved-profile retrieval failure retains the device's saved ID,
  provides a retry, and prevents accidental save while recovery is unresolved.
  Only a confirmed missing-record response clears the stale reference.
- Browser-storage failure after a successful API save is reported separately
  from a failed save; the UI keeps the returned profile ID and record.
- Profiles include an editable professional summary and stable-ID records for
  education, experience, projects, certifications, and achievements. Skill
  evidence links point to those user-provided records and are self-reported,
  never independently verified. Existing profile JSON payloads receive defaults
  for the additive fields; this feature does not require a SQLite table migration.

### Synthetic CV import

- `POST /api/profiles/extract-cv` accepts PDF and DOCX bytes up to 2 MiB after
  an explicit fictional-demo confirmation. PDF parsing is bounded to 30 pages
  and extracted text to 30,000 characters; DOCX uses Python's standard ZIP/XML
  libraries and rejects overly complex documents.
- Recognized section headings preserve wording under summary, skills,
  experience, education, projects, certifications, and achievements. Skill
  aliases are matched only against the local vocabulary; unmatched labels stay
  for user review. No proficiency, titles, dates, responsibilities, or
  achievements are inferred.
- The preview is editable and does not save a profile. The user must apply the
  reviewed text to the ordinary profile form and save it separately. Scanned
  PDFs, OCR, `.doc` files, corrupt files, and real personal CVs are unsupported.
- The original file is not retained, but the API does not inspect content for
  real personal information. Treat the synthetic-only rule as mandatory.

### Profile indicators and CV Studio

Four deterministic indicators use the saved fictional profile:

1. **Profile information:** filled checks / 8 checks (summary, education,
   study field, occupation or experience, skills, interests or strengths,
   aspiration, and a project/certification/achievement).
2. **Skills linked to examples:** skills with at least one evidence-record ID /
   all saved skills.
3. **Experience descriptions:** experience entries with non-empty descriptions /
   all saved experience entries; unavailable when there are no entries.
4. **CV structure checklist:** satisfied content-presence checks / 4
   (summary, skills, at least one education/experience/project record, and a
   title or description for each experience/project entry).

These are profile-content checks, not writing-quality, employability, or hiring
scores. CV Studio previews only saved profile information, offers two layouts,
and invokes the browser's print / Save as PDF flow. Browser export and multi-page
print layout still need manual confirmation.

### ESCO-backed registration search and skill extraction

Registration skill search and AI-assisted skill extraction use the committed,
verified full English ESCO v1.2.1 snapshot at
`data/index/esco_v1.2.1_en.json.gz`. The index manifest records its acquisition,
coverage, integrity hash, version assurance, and attribution; the application
does not call the ESCO API during search or extraction. Search uses ESCO skill
concept URIs only. AI extraction retrieves a bounded candidate set locally,
sends those candidates with fictional profile evidence to RunPod after
confirmation, validates returned IDs against that set, and verifies each quote
against its source text. The full taxonomy is never placed in a model request.
If the full verified snapshot is unavailable, search/extraction reports an
error rather than falling back to the local prototype vocabulary.

Reviewed ESCO skill IDs are retained when registration data is saved and are
validated against the pinned snapshot before profile persistence or matching.
ESCO content remains subject to the European Commission's reuse conditions
cited by the [ESCO FAQ](https://esco.ec.europa.eu/en/about-esco/faq). The
required attribution is: “This service uses the ESCO classification of the
European Commission.”

## AI-Trend Signal Layer

### Source and metric

- Provider: [OpenAlex Works API](https://api.openalex.org/works).
- Documentation: [OpenAlex API](https://developers.openalex.org/).
- License: [OpenAlex data is CC0](https://openalex.org/about).
- No API key is required for basic queries. An optional `OPENALEX_API_KEY`
  environment variable is supported, but the app does not require a paid
  service.
- Five reproducible full-text search phrases are queried: `large language
  model`, `AI agent`, `retrieval augmented generation`, `computer vision`, and
  `responsible AI`.
- The measurement is the number of indexed OpenAlex Works records whose
  searchable full text matches a phrase, grouped by publication year. The app
  reports the query URL, publication year, retrieval timestamp, source, and
  measurement alongside the observations.
- Each refresh requests the five most recent completed publication years. The
  partial current year is excluded. A refresh is user-triggered and subject to
  a one-hour cooldown.

These counts describe indexed research activity only. They are not job
openings, hiring demand, skill prevalence in vacancies, or forecasts. Search
phrases are not a controlled subject taxonomy, can match unrelated mentions,
and can overlap. OpenAlex coverage can also change. The app does not infer
missing annual values or display a percentage when the baseline is zero.
Changes are compared only across adjacent years with at least 10 matching
records in both periods.

All five topic requests must validate before a refresh replaces the cached
periods. If the source fails, the API reports the failure and keeps any
previously cached real observations. If there is no cache, the real dashboard
stays empty and displays an unavailable state. Synthetic demo observations are
served separately by `GET /api/trends/demo` and are never substituted into the
real cache.

### Transparent relevance

The prototype uses explicit skill-to-topic mappings. Each explanation is
displayed as a rule, not as a ranked career match. Skills outside the current
mapping return “no available signal.” These links do not establish employment
outcomes.

### User-facing workspace

The Next.js workspace provides My Home, My Profile, CV Studio, My Skills
Outlook, Explore Skills, and Source Evidence. Home summaries are limited to the
saved profile and exact skill-ID matches in the cached Remote OK snapshot.
Skills Outlook keeps exact employment keyword overlap separate from explicit
profile-to-OpenAlex topic associations; it does not create role matches.

Explore Skills supports search, a saved-profile filter, interest-word overlap,
the local vocabulary list, and a separate dated AI research view. The research
view only calls a topic “emerging” when a comparable period is available and
the indexed publication count has increased; it is not a hiring-growth signal.
The interest filter is a transparent normalized-word overlap, not semantic
similarity.
“Most mentioned” and “Least mentioned” order only the configured Remote OK
keyword measures; zero counts are included only for skills whose phrases are
configured. Other vocabulary entries say “No configured measure” rather than
being assigned zero. Each card can expand to show measurement, denominator,
period, retrieval time, source, coverage, and limitations. Employment growth
filters remain disabled because only one snapshot exists; AI exposure remains
disabled because there is no defensible task/occupation dataset mapped to the
local skill vocabulary.

### Separate employment-posting snapshot

[Remote OK](https://remoteok.com) is the selected public employment feed.
The [source evaluation and reuse conditions](employment-source.md) cover the
alternatives, conditional attribution permission, collection limits and metric.
The scope is international, not Malaysia-only, but this one remote board is not
representative of the global labour market.

An explicit refresh retains up to 100 validated, deduplicated postings.
Publication/retrieval dates, source IDs/URLs, source metadata and exact keyword
evidence are stored separately from OpenAlex. Indicators count each posting once
per configured skill, divided by all retained postings. No historical employment
growth is calculated. Job availability and keyword requirements are not verified.

The radar has research topic selection, separate employment topic/skill filters,
inspectable original posting links, and explicit cache/loading/error/empty states.
Exact non-null skill IDs can show saved-profile keyword overlap; this is not
Feature 3 role matching. Source snapshots are real only; the existing research
demo remains visibly synthetic and separate.

## API routes

| Route | Purpose |
| --- | --- |
| `GET /api/skills?q=...` | Search the legacy local vocabulary and show its provenance |
| `GET /api/v2/skills?q=...` | Search ESCO v1.2.1 skill concepts from the full local snapshot |
| `GET /api/profiles/samples` | Return five fictional profile drafts |
| `POST /api/profiles` | Validate and persist a fictional profile |
| `GET /api/profiles/{id}` | Retrieve a saved profile |
| `PUT /api/profiles/{id}` | Replace a saved profile |
| `GET /api/profiles/{id}/insights` | Return deterministic profile-content indicators |
| `POST /api/profiles/extract-cv` | Extract bounded text from a confirmed synthetic PDF/DOCX without saving the upload |
| `POST /api/profiles/extract-profile-skills` | Start transient skill extraction using bounded ESCO v1.2.1 candidates; poll `GET /api/profiles/extract-profile-skills/{job_id}` for status and results |
| `GET /api/trends/topics` | Return search definitions and measurement notes |
| `GET /api/trends/sources` | Return provider and license metadata |
| `GET /api/trends` | Return the real-data cache without making a source request |
| `GET /api/trends/history?topic_id=...` | Return cached publication-year observations |
| `POST /api/trends/refresh` | Explicitly request a live refresh |
| `GET /api/trends/demo` | Return visibly synthetic example observations |
| `GET /api/trends/relevance?profile_id=...` | Explain explicit skill-to-topic links |
| `GET /api/employment/source` | Return Remote OK provenance and conditional reuse notes |
| `GET /api/employment` | Read the employment snapshot without contacting a provider |
| `POST /api/employment/refresh` | Explicit bounded refresh, at most one attempt per 24 hours |

FastAPI's interactive schema is available at `/docs` when the API server is
running.

## Offline checks

From the repository root:

```sh
python -m unittest discover -s tests -p 'test_*.py'
npm --prefix src/frontend run test:logic
npm --prefix src/frontend run test:components
npm --prefix src/frontend run typecheck
npm --prefix src/frontend run build
```

Unit and ASGI route integration tests use temporary SQLite databases and mocked
providers; they do not contact external services. Frontend logic and React
component-rendering tests use Node's built-in test runner. See
[testing procedures](testing.md) and [the executed verification report](feature-1-2-verification.md).
