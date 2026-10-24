# Career Details asynchronous generation

The browser first calls the existing `/api/v2/roles/analysis` with
`generate_ai:false`; ESCO evidence renders immediately. It then starts or
retrieves a durable job with `POST /api/v2/roles/analysis/jobs` (same role and
recognised skill IDs). Every later request uses
`POST /api/v2/roles/analysis/jobs/status`, supplying the opaque local `job_id`,
`evidence_key`, role and recognised IDs. Polling cannot submit inference.

The shared backend Runpod client uses POST `/run` and GET `/status/{job_id}`,
each with a 5s HTTP deadline and no automatic transport retries. API keys and
provider job IDs stay server-side. The original Career prompt, input payload,
GLM-5.3, temperature0.2, 1500-token limit and `validate_analysis()` are unchanged.
Only async submissions add Runpod's 300000ms execution/TTL policy. See the
[official request documentation](https://docs.runpod.io/serverless/endpoints/send-requests).

## Persistence and bounds

`career_analysis_jobs` is an additive table in the existing SQLite database.
An evidence fingerprint binds the role, recognised IDs, ESCO version/index and
prepared evidence. A transactional unique row is committed **before** provider
submission, so concurrent starts and ordinary dev reloads recover that row.
No full profiles, personal text, complete prompts, raw provider outputs or
credentials are stored. Validated analysis alone is persisted on completion.

There are at most16 active jobs and256 records. A 300s overall job lifetime is
enforced locally and via Runpod's job policy. Polls are separated by3s and a
cross-process8s lease prevents simultaneous status calls. Completed validated
results are cached in SQLite and the existing process cache for6h. Terminal rows
remain as bounded tombstones to prevent automatic resubmission. At record
capacity, new evidence bundles retain deterministic fallback instead of silently
deleting failure records or spending more credits. Administrative cleanup would
need a deliberate policy; it is not automatic in this prototype.

Pending/running/failed/expired states are explicit. Missing keys or unverifiable
evidence cause an unavailable state without submission. Failed submission or
status requests stop polling. A submission whose response is lost may already
exist remotely; it is marked terminal, never retried on refresh. If the process
dies mid-submission, the recovered `submitting` row becomes terminal after10s.
Such an unknown remote job may still run until its TTL; do not retry immediately
without understanding possible duplicated provider work.

An explicit start with `retry_failed:true` and `retry_job_id` matching the
current terminal ticket may replace it atomically. The button below Transferable
Skills Mapping sends this only on a deliberate click; refresh and normal lookup
never send it. Pending/completed jobs are recovered instead of replaced. A stale
ticket cannot replace a newer failure, even if concurrent submissions fail quickly.
Old tickets cannot retrieve the replacement job. Completed cache expiry also
requires explicit retry.

The response exposes only safe `retryable` and `retry_blocked_reason` eligibility.
Retry requires recognised matching inputs, unevidenced groups and configured
credentials. Authentication errors remain blocked pending configuration review.
Uncertain submission/status failures must wait beyond the existing five-minute
remote TTL plus the five-second submission deadline; known terminal provider
failures/output rejections can retry immediately. Active-job capacity is enforced
inside the write transaction. History metadata (ticket, provider ID, endpoint,
status/error and timestamps only) is retained in an additive `history_json` column
in the existing jobs table and never exposed to browsers. No prompts, raw output
or personal data are added. After thirty-two retained attempts, further retries
are blocked instead of silently deleting history. No automatic cleanup is added.

The click is synchronously guarded, disables the control and reuses the existing
poller. Role/profile changes abort polling and discard stale updates. A network
interruption retains ESCO evidence and asks the user to reopen the page to recover
the existing ticket; it cannot silently submit another inference.

Status requests recompute the fingerprint and must match both it and the local
ticket. Clients cannot supply arbitrary Runpod job IDs. Like existing profile
APIs, this remains a local prototype without authenticated account ownership;
identical public evidence bundles are shared, not a private per-account store.

## Frontend behaviour

Polling is bounded to5min, every2ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“5s, and stops on failure/completion/expiry.
Unmounting or changing the role/profile aborts polling and ignores stale results.
Refresh starts the same evidence-keyed lookup, not another provider job. The
existing cards, sources, gauges, fallback copy and layout remain unchanged.
No background thread or separate queue framework is needed: Runpod runs the job,
and polling performs short status reads. If a browser closes, results are first
retrieved when someone resumes the same evidence bundle; Runpod retains async
completed output for30min. A job older than our5min bound is expired rather than
resubmitted, even if its provider output may still exist.

The old `generate_ai:true` synchronous API remains for backward compatibility;
the updated frontend no longer calls it. Career Demo, Pathway discovery and SH's
signal workflows still use their original transports/deadlines. Their behaviour
has not been converted to async by this change.

## Verification

All provider responses in tests are mocked. No live Runpod, health, Tavily or
evidence-refresh requests were made. No production profile data was modified.

- **37 backend checks passed** (including two focused Pathway regressions): new durable jobs/API and transport coverage, original
 Career analysis/grounding and sanitized diagnostics. An initial test harness
 hid the real transport behind its own mock; that harness was corrected.
- **Seven polling-helper tests passed**: success, refresh, terminal states, abort,
 stale evidence/role, network failure and bounded lifetime.
- **Seven existing component checks passed**: ESCO/AI fallback, overview metrics and
 Pathway origin presentation.
- **TypeScript and production build passed**. The build's generated tsconfig additions
 were removed. The original prompt was also compared against pre-change Git
 source and matched exactly.

Live async endpoint/handler compatibility is not yet verified. One separately
approved live integration test is recommended: submit one fictional evidence
bundle, poll its existing job and confirm validated output, without retries or
Tavily. No additional production timeout increase is needed for the browser.

## Files

- `src/services/sources/runpod_api.py`: shared async operations.
- `src/services/future_roles/pathway_llm.py`: reuse request builder/output parser.
- `src/services/future_roles/career_analysis.py`: shared unchanged instructions.
- `src/services/future_roles/career_jobs.py`: durable lifecycle and validation.
- `src/services/storage.py`: additive job table.
- `src/models/career_analysis.py`, `src/api/future_roles.py`: additive job APIs.
- `src/frontend/lib/career-analysis.ts`, `career-analysis-job.ts`: bounded polling.
- `tests/test_career_jobs.py`, `tests/frontend_career_jobs.test.ts`: focused tests.
- This document. No commits or pushes performed.


## Stage-specific failure diagnostics (2026-10-24)

Completed provider output now records safe error codes instead of collapsing
parsing and grounding failures into `invalid_output`:

| Failure stage | API/database error code |
|---|---|
| Missing/unsupported wrapper, choices/message/content | `unsupported_output` |
| Model finish reason length | `model_truncated` |
| Content cannot be parsed as JSON | `invalid_json` |
| Strict generated Pydantic schema | `invalid_generated_schema` |
| Existing ESCO IDs, quotes, bridge membership or wording rules | `invalid_esco_grounding` |
| Valid structure with no supported interpretations/bridges | `no_supported_interpretations` |
| Unexpected implementation exception | `unexpected_output_error` |

Each failure log contains only local job ID, stage, category, exception class,
allowlisted finish reason and numeric standard token counts. Unknown finish
reasons become `other`; absent metadata stays absent. Token fields must be
finite, nonnegative, non-boolean numbers no larger than one billion. Provider
error bodies, exception messages/tracebacks, Pydantic errors/inputs, prompts,
evidence, credentials and model content are never logged. Numeric usage can be
read from the supported normalized output or the outer response.

Grounding failures use EvidenceGroundingError (a ValueError subclass), preserving
the exact existing conditions and messages for existing callers. Parsing uses
existing typed LLMResponseError categories; Pydantic ValidationError identifies
generated-schema failures. No exception-message matching is used to classify
these stages. Unexpected exceptions retain only stage and exception class;
these diagnostics do not claim to infer an unknown underlying cause.

This update changes no job submission/polling/deduplication/cache timing, SQLite
schema, five-minute lifetime, frontend layout, prompt, model or token limit.
Valid supported wrappers still validate and enter both caches unchanged. Old
failed rows keep their old error codes: lost historical output cannot be
reconstructed, and no old job was retried or modified by this implementation.

Verification for this diagnostic update: 43 backend checks passed (41 job,
analysis and transport checks plus two focused Pathway regressions), 13 frontend
checks passed (seven polling and six existing component checks), TypeScript and
production build passed. The final telemetry fallback adjustment also passed its
focused rerun. All providers were mocked; no live Runpod/Tavily calls, commits or
pushes occurred. Earlier uncommitted async work was preserved.


## Explanation wording compliance (2026-10-24)

The controlled async test subsequently completed with valid schema/JSON but
failed the explanation wording guard. CAREER_INSTRUCTIONS now explicitly scopes
its rules to `why_relevant` and `explanation`: may/could; original word limits;
no numeric digits, percent/angle symbols, URLs/website references, version/score
language, forbidden proficiency/credential terms, guarantees or impact tiers.
It gives natural-language wording as an alternative to digit-labelled concepts.
Identifiers and `evidence_quote` are explicitly exempt from these prose rules:
quotes must remain verbatim, including original digits and symbols. Grounding
and strict schema requirements are retained.

Only the prompt, its regression tests and this documentation changed for this
wording fix. The model, temperature,1500-token limit, timeout/lifecycle/cache
settings and prompt-version/cache key were not changed. Existing valid cached
responses remain usable; old terminal failures still require explicit retry,
not an automatic new job. `_safe_interpretation` and `validate_analysis` were
compared structurally before/after this change and are identical.

Verification:39 distinct backend checks passed after correcting a mocked quote
fixture (its referencing bridge needed the same updated verbatim quote). All
four wording regressions then passed together. Thirteen focused frontend
checks, TypeScript and production build passed. No provider calls or token-limit
changes were made. Actual live wording compliance remains unverified until a
separately approved inference test; instructions cannot guarantee compliance,
so the unchanged validator remains authoritative.

## Explicit retry verification (2026-10-24)

The retry control was verified without live providers:

- 51 Python checks passed across `test_career_jobs`, `test_career_analysis`
  and `test_runpod_diagnostics`, using temporary SQLite storage and blocked HTTP.
- 10 polling-helper tests and 5 focused Career component tests passed.
- 3 browser interaction tests passed: immediate double-click suppression and
  completed bridges; expired refresh without retry plus failed retry recovery;
  navigation cancellation and stale-result rejection. All API routes were mocked,
  and the frontend-only test server points at an unreachable backend.
- `npm --prefix src/frontend run typecheck` and production build passed.
- `git diff --check` passed. No staging, commits, pushes or live provider calls.

From `src/frontend`, run the focused browser suite with:
`npx playwright test --config playwright.career-retry.config.ts`.
It normally uses installed Playwright Chromium; this Windows verification used
`$env:PW_BROWSER_CHANNEL='chrome'` and `$env:CAREER_RETRY_TEST_PORT='3120'`
with installed Chrome. Test output stays in ignored directories. Initial attempts
were blocked by absent bundled Chromium and a locked old dev output directory;
the dedicated `.next-e2e/retry` directory avoids that old output.

A live retry remains separately unverified and requires explicit approval.
Provider availability, credentials and model wording compliance cannot be
established by these mocked checks. Existing local-prototype ownership and
capacity limits remain. Authentication failures, full history and full active-job
capacity hide the retry control rather than bypassing backend safety checks.
