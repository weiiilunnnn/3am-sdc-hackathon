# International employment source evaluation

Reviewed 2026-10-21 using the providers' official pages. Public access does not by itself grant reuse permission. These notes are a technical source assessment, not legal advice.

## Candidates

| Source | Access / reuse | Fields and coverage | Dates / history / limits / reliability | Decision |
| --- | --- | --- | --- | --- |
| [Remote OK](https://remoteok.com/faq#feeds-sponsorship) | Free public JSON/RSS, no key. FAQ explicitly permits aggregators/sharing with credit and original posting links. [Legal terms](https://remoteok.com/legal) and the feed's terms require links; feed asks for followed links and prohibits logo use without permission. No CC/open-data licence claimed. | Titles, companies, descriptions, tags, locations, source IDs/URLs. Remote-job board with international and country-restricted labels; missing locations and noisy tags. No standard occupation codes. | Posting date/epoch and feed-updated metadata. Refreshable public feed, no comparable historical endpoint established. No numeric rate limit found in cited FAQ; no availability warranty. | **Selected** for a small attributed posting snapshot, not a global labour-market estimate. |
| [Adzuna](https://developer.adzuna.com/docs/terms_of_service) | Registration/key required. Organisational/academic evaluation is limited to 14 days; ongoing work/research using raw **or aggregated** data requires written consent/licensing. | Multi-country job titles, descriptions, companies, locations and dates; richer employment statistics. | Current and historical APIs exist, but access/quotas depend on agreement. | Not selected: ongoing derived-dashboard permission is not established for this project. |
| [Arbeitnow](https://www.arbeitnow.com/blog/job-board-api) | Public no-key API with linkback, but [terms](https://www.arbeitnow.com/terms) describe personal, non-commercial, transitory viewing and revocable access. Persistent derived-dashboard permission is unclear. | Job descriptions, tags, company, slug, remote flag, location and created timestamp. Germany/DACH-heavy, plus remote listings. | Refreshable current feed; no comparable historical series established. API supplied as-is; tailored access may be paid. | Not selected: reuse ambiguity and narrower regional coverage. |
| [Remotive](https://remotive.com/remote-jobs/api) | Public API with attribution/original links, but restrictions on submitting data to third-party websites/aggregators and signup-gated display. | Remote jobs, category/tags, company, location, publication date and description; one board, not all employers. | Public data delayed 24 hours; recommends only a few daily fetches. No comparable historical series established; paid private service available but not used. | Not selected: redistribution restriction needs clarification for this dashboard. |

The rejected sources were researched through official documentation; they were not integrated or used as fallbacks. No credentials or paid services were added.

## Selected source and collection

- Source: **Remote OK**, `https://remoteok.com/api`, an unfiltered public feed. Query/tag filters are not trusted to define the sample.
- Source type: employer-posting metadata, kept separate from OpenAlex scholarly-research counts.
- Reuse basis: conditional public API permission with visible Remote OK credit and a normal followed link to each displayed original posting. The app uses no Remote OK logo, does not gate the data behind signup, and does not claim ownership or an open-data licence.
- Review URLs: [FAQ](https://remoteok.com/faq#feeds-sponsorship), [terms](https://remoteok.com/legal). A direct research request also inspected the feed's own attribution notice.
- Collection: explicit manual refresh only, 25-second timeout, response capped at 3 MiB and 1,000 feed items; retain at most 100 newest valid, unique records in the returned feed.
- Cache: one attempt per 24 hours, including failed attempts. This is an application policy, not an invented provider quota. Page loads read SQLite and do not contact the source.
- Refresh failure: preserve the previous valid snapshot and last-success timestamp. No synthetic fallback and no replacement with an invalid/empty feed.
- Provenance: persist the source configuration/terms-review date with the snapshot; keep original source job ID, original posting URL/date, normalized UTC publication date, per-record retrieval date, feed-updated time, counts of received/excluded records, and refresh state.
- Validation: require ID, nonempty title/company, valid zoned date or epoch, and HTTPS Remote OK original-posting URL. Reject grossly future dates, malformed records and external URLs. Deduplicate IDs and URLs. Plain text only; descriptions are processed transiently for keywords, not stored or rendered.
- Missing locations remain unknown. Provider location strings are not standardized countries or verified work eligibility. Employer counts use case-insensitive company names, not verified corporate entities.

## Indicators and interpretation

Configured skill phrases and topic rules are version-controlled in `src/data/employment_source.py`.

1. Count each retained posting once for each configured skill phrase it contains in title, provider tags or plain-text description.
2. Retain matched terms and fields as inspectable evidence.
3. Share = matching retained postings / all retained postings × 100. Skill shares can overlap and do not sum to 100%.
4. Topic filters use explicit phrases (for example, “large language model”/“LLM”). Broad “AI” does not automatically imply every AI subtopic; standalone “rag” is not treated as retrieval-augmented generation.
5. Profile overlap joins exact non-null local skill IDs only. It is neither a role recommendation nor evidence that the learner meets a job requirement.

**Do not claim:** representative global hiring demand, all international employers, verified active vacancies, an inferred requirement, a causal relationship with research, demand growth, forecasts, or zero market demand when a sample has zero mentions.

The source is a feed snapshot, not a longitudinal dataset. A publication date may reflect reposting and does not prove continued availability. Any future historical series needs a documented sampling protocol, stable collection intervals and comparability checks before growth can be calculated.

The live collection's actual counts and date span are reported separately in [the verification report](feature-1-2-verification.md), not assumed from these configuration limits.
