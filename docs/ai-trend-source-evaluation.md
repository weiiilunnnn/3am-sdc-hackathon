# AI Trend Signal source evaluation — 22 October 2026

## Decision

Use [Himalayas' documented public API](https://himalayas.app/api) as the primary **remote-job sample**, keeping Remote OK as a separate fallback. This improves coverage and access to full descriptions. It does **not** turn co-occurrence into a proven skill evolution or make the sample representative of Malaysia. The extraction rules were also too narrow: their previous same-sentence test found zero nontrivial pairs in live samples from every provider tested. The implementation now preserves HTML section boundaries, recognises common verb forms and labels separate-passage co-occurrence explicitly.

## Reproducible, bounded probes

The probes requested only public GET endpoints. They did not use a paid service or a model. Counts are sample observations, not estimates of each provider's complete inventory.

| Source and probe | Retrieved | Unique IDs | Descriptions ≥200 characters | Nontrivial same-sentence pairs with old extractor | Scope and access |
| --- | ---: | ---: | ---: | ---: | --- |
| Remote OK existing local cache | 99 | 99 | 99 | 0 | One mixed-location remote feed; public API with attribution requirements. |
| Himalayas first 12 browse pages, 20/page | 240 | 240 | 240 | 0 | Cursor-paginated remote feed; full descriptions, free unauthenticated tier. |
| Himalayas Malaysia search, first 3 pages | 57 | 46 | 57 | 0 | 11 repeated IDs across shifting search pages. Search eligibility is not Malaysian job location. |
| Greenhouse Anthropic board | 678 | 678 | 678 | 0 | Detailed employer-hosted descriptions, but one AI-heavy company is not occupation coverage. |
| Lever RyzLabs board | 46 | 46 | 46 | 0 | Detailed employer-hosted descriptions, but one selected company. |

The local 30-page Himalayas refresh retained **598 live jobs from 417 named employers** after two records failed the adapter's validation filters. All retained jobs had descriptions ≥200 characters. It produced **11 saved candidate connections** with revised deterministic extraction, including a direct passage linking data analysis and AI agents and repeated employer-level co-occurrence of Python and AI-agent work. Across the five demo profiles, the counts of supported connections are 4, 2, 2, 0 and 1, respectively; some skills have more than one connection. These counts depend on the live feed and will change. Each card exposes its exact source passages and limits. Only **2 of 598** retained jobs explicitly list Malaysia in `locationRestrictions`; another **15** have no country restriction. These are eligibility labels, not a measure of Malaysian vacancies. No Malaysian skill-demand claim is supported.

## Access and reuse

- [Himalayas API documentation](https://himalayas.app/api) exposes full HTML descriptions, a GUID, last-updated `pubDate`, expiry, eligibility restrictions and cursor pagination, max 20 jobs/page. It says the feed updates daily and offers a no-key shared allowance or a free key with 60 requests/minute and 10,000/day. [Its API terms](https://himalayas.app/terms) permit personal/commercial integrations on conditions: visible attribution and links, unchanged `applicationLink` for any Apply action, no onward job syndication, caching within limits and removal of expired jobs. The app does not implement an Apply action. It shows provider links and does not retain full-text Himalayas snapshot history; its daily refresh replaces active listings and removes stale extraction cache entries. A future feature that republishes full job data elsewhere would need another review.
- [Greenhouse's Job Board API](https://docs.greenhouse.io/job-board) allows unauthenticated GET requests and `content=true` for full descriptions. It is organized by employer board, not a single broad discovery feed. The public docs describe building the employer's own career site; this evaluation did not establish blanket permission to collect many unrelated boards into our analytics product. Treat broader reuse as unresolved until rights are confirmed.
- [Lever's Postings API](https://github.com/lever/postings-api) supplies plain-text descriptions for a known employer site. Its published use case is a custom job site; this evaluation likewise did not establish blanket cross-employer analytical reuse. Board discovery and sampling bias remain unsolved.
- [Adzuna's API terms](https://developer.adzuna.com/docs/terms_of_service) offer a free evaluation key and permit personal/academic research, but require registration and written agreement for some other uses. No key was available for a live probe, so it was not selected.

## Architecture and limits

The background scheduler checks both remote sources daily and prefers the Himalayas cache when nonempty. Each accepted job has provider ID, canonical URL, normalized full text, employer, eligibility restriction, last-updated time, expiry and collection time. The processor fingerprints normalized documents, reuses unchanged extractions, checks exact quotes, and version-publishes connections. Removed/expired Himalayas documents are excluded from page results, and stale extraction records are removed on processing. Page GETs read SQLite only; RunPod remains disabled unless separately configured with a key and budget.

Browse-page sampling is a moving slice ordered by provider activity; even after weeks of collection, repeated shares from the first 600 records would not justify a labour-market growth claim. A defensible historical series would need a stable sampling frame or complete feed, consistent collection windows, deduplication by job identity across dates, original publication dates rather than last-updated times, and enough independent observations for each occupation and geography. Himalayas `pubDate` is **last updated**, so this implementation shows current sample prevalence only. It does not preserve expired listings as a permanent raw dataset.
