# Feature 4: bounded dynamic reskilling discovery

Implemented 22 October 2026. Scope: learning-resource discovery only; ESCO
matching/search, SDG functionality and the Random Forest service are unchanged.

## Runtime and evidence

`src/api/future_roles.py` reconstructs a trusted selected-role match and complete
missing-essential list. `resource_discovery.py` sends only canonical occupation,
gap/recognised-skill IDs/labels/proficiency and non-identifying learning preferences.
Names, profile IDs, raw CVs, emails and attachments never enter provider prompts.

`pathway_llm.py` imports the team's `runpod_api.run_sync` / `unwrap_llm_output`,
and the existing SDG `LLM_ENDPOINT_ID` default. It requests `glm-5.3` using the same
Serverless `runsync` nested `input` envelope. `RUNPOD_LLM_ENDPOINT_ID` overrides
that shared default. `RUNPOD_ENDPOINT_ID` remains the separate RF service.
No transport, authentication, endpoint ID or SDG logic is duplicated.
The requested model ID does not establish deployed weights, GPU hardware,
geography, sponsor quota or billing; these require team/provider confirmation.

Call 1 proposes bounded queries tagged with server-owned gap IDs. Strict schemas
reject invented fields/URLs/IDs. Unavailable planning uses deterministic skill-label
queries only when Tavily is configured. Tavily Search supplies URLs, then Extract
supplies provider markdown. Search snippets alone never establish verification.
Call 2 ranks only server-generated candidate IDs with an exact supporting quote;
invalid output falls back to deterministic selection among checked candidates.
Model rationales are advisory and are never rendered as verified evidence.

`resource_verification.py` requires a matching extracted heading, specific learning
page, non-title curriculum support for an exact ESCO name/alias, and source URL.
Access, price and duration claims require separate literal provider statements.
Unknown price stays unknown and is ineligible for zero-budget pathways. Certificate
and regional conditions are not inferred. Unknown duration stays unknown and gets
no invented app duration. Explicit non-empty prerequisites need reviewed canonical
mapping and currently cause exclusion; absent prerequisites remain *unknown*.
The initial provider scope is restricted to official learning domains listed in
`PROVIDERS`. There is no arbitrary local HTTP fetcher: only fixed Tavily API hosts
are called, with redirects rejected, HTTPS/public-provider URL checks, bounded
response size (1 MB), text size, timeouts and candidate counts.

Source records and short per-skill/per-claim excerpts are returned in response-local
`sources`, without mutating the global registry/catalogue. These are automated
provider-content checks, not manual curriculum accreditation or proof of mastery.
Retrieval timestamp records the successful Extract check, not a fresh direct GET.
Original search URLs are retained alongside canonical URL identities.

## Planner and fallback

The existing planner remains authoritative for coverage, total budget, currency,
prerequisites, ordered phases, known/unknown time and uncovered gaps. Its only
selection extension prefers eligible web origin/ranking after coverage, format and
duration-availability checks. Local-only selection order remains equivalent.
Reviewed local resources remain available for uncovered gaps and more suitable
choices. Duplicate curated URLs retain original catalogue IDs and dependencies.
The current repository has **22** local resource records (not the historical eight).
No original resource records, URLs, costs or duration meanings were edited.

`/api/pathways` keeps its request and original response fields. Additions describe
origin, retrieval mode, individual evidence, discovery status, source records and
counters. Status reflects resources actually selected, not just search hits.
The existing PathwayView adds origin/check-date/fallback notices and uses the
response-local evidence registry. Its structure, navigation and scheduling remain.
Loading uses a real activity label; the existing AbortController prevents stale
role/profile responses overwriting current state.

## Bounds, caching and source terms

Defaults (application bounds, not provider limits): 3 basic searches, 4 hits/search,
8 unique extraction URLs, at most two GLM calls, and 25 seconds overall. Hard caps:
5 queries, 12 URLs, 25 seconds (compatible with the existing synchronous proxy).
GLM/extraction timeouts are at most 5 seconds, search at most 3 seconds, all capped
by remaining time. Cold starts may therefore use the honest catalogue fallback.
No new dependency is installed; transports use Python standard libraries.

Process-local bounded caches retain public metadata/excerpts for up to 168 hours:
32 topic/constraint results, 128 provider URL records. Identical in-flight requests
are coalesced (16 concurrent topic keys), while each user's plan is built separately.
No profile ID, raw CV, secret or private text is cached. Failed discovery is cached
for 60 seconds. Cache survives refresh, not process restart; it is not cross-worker.
Only concise necessary excerpts/links are retained; no complete course materials.
Provider rights and access restrictions remain applicable; no paywalls are bypassed.

Official sources inspected on 22 October 2026:

- [Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search):
  `POST https://api.tavily.com/search`, basic/general, no generated answer/raw page.
- [Tavily Extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract):
  `POST https://api.tavily.com/extract`, basic markdown, bounded shortlist.
- [Tavily pricing](https://www.tavily.com/pricing): advertised free Researcher plan
  has 1,000 API credits/month, no card. Actual team quota/tier not verified. No
  paid-plan enrollment occurs. Usage credits are recorded only when returned.
- Existing pinned ESCO v1.2.1 source registries/attribution remain authoritative.
  Course mappings are conservative application-derived evidence checks, not ESCO
  endorsements. Existing local mappings remain application-curated.

Counters include search/extraction/GLM attempts, verified/rejected/cache counts,
returned Tavily credits and elapsed seconds. Logs contain numeric counters and
bounded reason codes only, not secrets, provider bodies or personal information.

## PowerShell setup

Install the existing dependencies and create your own local configuration:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm --prefix src/frontend install
# Only if .env does not already exist:
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Edit the repository-root .env locally; never commit or paste its contents.
npm --prefix src/frontend run dev
```

Enter `RUNPOD_API_KEY` and `TAVILY_API_KEY` in the root `.env`.
`RUNPOD_LLM_ENDPOINT_ID` is an optional GLM override; leave blank to retain the
existing team default. `RUNPOD_ENDPOINT_ID` remains the separate RF model.
`src/environment.py` loads this absolute repository-root path before FastAPI's
router/provider imports. Blank values are skipped and existing system variables
always take precedence. Variable interpolation is disabled. Restart the backend
when editing credentials; no real keys belong in `.env.example` or chat.

The launcher command is unchanged. Local `.env` loading happens only inside
FastAPI, not in the launcher/Next.js process. The launcher also strips manually
inherited provider keys from the Next.js child environment. `.env` and `.env.*`
are ignored by Git, except `.env.example`. Teammates copy the example and enter
credentials on their own computers. Missing credentials retain local fallback.

## Verification and declarations

Routine tests mock both providers. `tests/test_resource_discovery.py` covers strict
schemas, shared transport, verification, missing keys, outages/quotas, fallback,
mixed coverage, duplicates, budget/currency, unknown duration/prerequisites, cache
expiry/coalescing, user isolation and URL safety. Existing reskilling/search tests
and two-profile live-index API regression preserve compatibility. Frontend rendering
tests cover provenance, response-local citations, unknowns and catalogue fallback.

Actual optional provider smoke test, only after keys and network are configured:

```powershell
.\.venv\Scripts\python.exe scripts/smoke_feature4_discovery.py --live
```

It uses two synthetic profiles/distinct occupations, bounded provider calls,
reports up to three distinct extracted provider pages (or fewer with explanation),
and writes a credential-free `.cache/feature4-live-audit.json`. This does not test
purchase/enrollment or certify course quality. Without keys/`--live`, it explicitly
reports **LIVE END-TO-END NOT TESTED** and makes no provider calls.

Known limits: exact-label verification misses semantic matches; the trusted domain
scope is narrow; blocked extraction, ambiguous/unmapped prerequisites, prices and
timings reduce coverage. Unknowns remain visible. There are no live account/quota,
provider hardware/location or general production-availability guarantees.
Codex assisted implementation and tests; humans must review provider access,
curriculum claims and sponsor/tool declarations. No team PDF submissions were edited.

### Executed results for this implementation

- 22 mocked discovery/transport tests passed.
- 10 existing planner tests passed; 6 existing ESCO search tests passed.
- Two-profile actual-index HTTP pathway regression passed (one test).
- 4 SDG/RF/router integration tests passed. The old route-count assertion was
  updated to include the already-existing `/api/v2/profiles/{profile_id}` adapter;
  Feature 4 adds no endpoints.
- 5 launcher tests passed, including backend-only credential inheritance.
- 11 frontend component rendering tests passed, including provenance/unknowns.
- **LIVE END-TO-END NOT TESTED:** provider credentials are not configured in this
  execution environment. The opt-in smoke script correctly skipped all calls.
- The legacy root-page blocker was subsequently fixed by archiving the old
  `src/frontend/app/page.tsx` under `docs/legacy/`; `/` redirects to `/register`.
  TypeScript and the normal production build passed after clearing stale generated
  caches. Running `/`, `/role-matching` and the API proxy returned HTTP 200.
- Focused browser checks were attempted but blocked by a OneDrive cloud-file
  timeout (os error 426) in `.next-e2e/dev/cache/turbopack`. They are not claimed
  as passing; the isolated stalled run was stopped. Provider keys were disabled.


Local-only reference checks: demo-graduate-a had 29 gaps / 9 selected resources /
24 uncovered gaps; demo-graduate-b had 15 / 4 / 12, respectively. These use the
reviewed local occupation catalogue; the HTTP regression also uses the full index.
