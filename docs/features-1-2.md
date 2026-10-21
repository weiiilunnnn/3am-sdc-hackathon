# Features 1–2: profile intake and research-trend signals

This prototype implements only Skills Profile Intake and the AI-Trend Signal
Layer. Career matching, reskilling recommendations, SDG mapping, and future
scenarios remain out of scope.

## Skills Profile Intake

- Profiles are accepted only with `synthetic_demo: true`; the web form requires
  the user to confirm that the information is fictional.
- Do not enter real CVs, names, contact details, or other personal information.
  There is no file upload or authentication.
- Profile create, read, and update data is stored in SQLite. By default the
  database is `src/data/future_ready.sqlite3`; set `APP_DB_PATH` to use another
  location. SQLite database files are excluded from Git.
- Skill matches use stable `local:` identifiers in the current prototype.
  Unknown skills are kept as custom entries without an identifier rather than
  being silently mapped to a known concept. Duplicate known skills are merged;
  the highest supplied proficiency is retained and the original labels are
  preserved. A user can explicitly keep a known alias as custom, and that
  choice is preserved when the profile is updated.
- Five fictional sample profiles are available from
  `GET /api/profiles/samples`; loading a sample in the UI does not save it until
  the user submits the form.

### ESCO status

The official ESCO API and reuse terms were investigated. The API returned HTTP
500 during its announced maintenance on 21 October 2026, and the classification
pages returned a temporary-issue message alongside conflicting concept status.
To avoid shipping potentially obsolete or mislabelled ESCO identifiers, this
version uses a documented, small local vocabulary and labels it as such. It
does not claim the local identifiers are ESCO URIs.

ESCO's official FAQ says the classification may be reused free of charge,
subject to attribution; see the [ESCO FAQ](https://esco.ec.europa.eu/en/about-esco/faq).
When service access is restored, verify each concept's status in a pinned
version before adding ESCO URIs. The required attribution for future ESCO-backed
services is: “This service uses the ESCO classification of the European
Commission.”

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

## API routes

| Route | Purpose |
| --- | --- |
| `GET /api/skills?q=...` | Search the local vocabulary and show its provenance |
| `GET /api/profiles/samples` | Return five fictional profile drafts |
| `POST /api/profiles` | Validate and persist a fictional profile |
| `GET /api/profiles/{id}` | Retrieve a saved profile |
| `PUT /api/profiles/{id}` | Replace a saved profile |
| `GET /api/trends/topics` | Return search definitions and measurement notes |
| `GET /api/trends/sources` | Return provider and license metadata |
| `GET /api/trends` | Return the real-data cache without making a source request |
| `GET /api/trends/history?topic_id=...` | Return cached publication-year observations |
| `POST /api/trends/refresh` | Explicitly request a live refresh |
| `GET /api/trends/demo` | Return visibly synthetic example observations |
| `GET /api/trends/relevance?profile_id=...` | Explain explicit skill-to-topic links |

FastAPI's interactive schema is available at `/docs` when the API server is
running.

## Offline checks

From the repository root:

```sh
python -m unittest discover -s tests -p 'test_*.py'
pnpm --filter 3am-sdc-frontend run test:logic
pnpm --filter 3am-sdc-frontend run typecheck
pnpm --filter 3am-sdc-frontend run build
```

The unit tests use temporary SQLite databases and fake trend sources; they do
not contact OpenAlex. The interface chart and profile-validation checks use
Node's built-in test runner.
