# Focused provider readiness audit — 2026-10-23

Verdict: **PARTIALLY VERIFIED**; live AI remains blocked. No full workflow rerun.

## Current evidence and usage

- Root environment loading reports Runpod and Tavily keys present; LLM override
  absent, so `pathway_llm.invoke` selects the existing shared SDG GLM endpoint.
  The Random Forest endpoint variable is not used.
- One read-only `GET /health` through the shared Runpod transport returned
  **HTTP 401**, category `authentication`, in **0.657s**. This establishes that
  telemetry access failed, not why the previous inference requests timed out.
  No worker/queue counts, deployment logs, actual deployed model identity,
  time-to-first-token or inference timing could be observed.
- **0/3 Runpod inference calls**. No payload or timeout change is justified.
- **1/1 Tavily search**, approximately 5s including local imports, one reported
  credit. Existing reviewed domains were passed. Search requested OpenLearn
  machine-learning free-course evidence, but returned other reviewed providers.
- **1/1 extraction**, approximately 2s including imports, zero reported credits.
  Selected official URL:
  https://learn.microsoft.com/en-us/shows/machine-learning-for-beginners
  Its text establishes a video course and machine-learning curriculum, but says
  the *linked curriculum* is free/open-source. This is not sufficient evidence
  that the video course's access conditions are free. It remains ineligible;
  no new resource was selected and no live AI evaluation was attempted.

## Resource rejection trace

| Resource | Verified content/type | Eligibility outcome |
|---|---|---|
| Google Numerical data: Normalization (saved extraction) | Machine-learning concept; conservative documentation type | No explicit free/access price evidence; excluded |
| Microsoft Normalize Data component (saved extraction) | Machine-learning reference documentation | No explicit free/access price evidence; excluded |
| Microsoft Machine Learning for Beginners (new extraction) | Video course; learning classical machine learning | Referenced curriculum is free; course access remains unknown; excluded |

Saved Google text includes a Creative Commons licence. This is not converted
into a free-course claim. Microsoft component documentation is not relabelled
as a course. Unknown duration is already permitted by the planner; unknown
level is optional. Explicit unmapped prerequisites need reviewed mapping.
Unknown access/pricing is a necessary blocker under existing eligibility rules.
There are no verified certificate/exam fees for these pages.

## Request trace and unchanged limits

- `/api/v2/roles/analysis` → `career_analysis.analyse_career` →
  `pathway_llm.invoke` → shared `runpod_api.run_sync` (`POST /runsync`).
  Career: 25s, 1500 output tokens, evidence-grounded batched groups/bridges;
  deterministic content comes first. In-flight calls are coalesced, followers
  wait at most 26s; success/failure caches remain unchanged.
- `resource_discovery` calls `pathway_llm.plan` (12s/1000 tokens) and
  `evaluate` (5s/1600 tokens), within its existing 25s discovery deadline.
  Certification discovery shares the 27s outer request deadline. The Next
  rewrite proxy has a 30s default. HTTP timeouts do not establish that a remote
  job was cancelled; no cancellation or infrastructure changes were made.
- Shared envelope: `input`, model `glm-5.3`, temperature 0.2,
  `response_format: json_object`, system/user messages; strict response schemas
  and literal evidence validation remain unchanged. Endpoint readiness/payload
  compatibility cannot be established from the inaccessible health response.
- Resource AI ranking is optional: existing deterministic eligibility can admit
  verified resources when evaluation fails. It cannot supply missing access
  evidence. No new fallback or planner semantics were introduced.

## Exact changes and focused checks

- `runpod_api.py`: factor existing transport into `_request`, add read-only
  `health`; reuse authentication, sanitized error categories and no-retry policy.
  Existing `run_sync` request semantics are preserved.
- `test_runpod_diagnostics.py`: GET/no body/single-call health and sanitized
  401 coverage.
- `test_resource_discovery.py`: regression for the official Microsoft access
  distinction, plus documentation-not-course classification.
- **15 focused unittest tests passed**: transport/health categories, mocked
  Career success/bridges and timeout fallback, unknown-access rejection,
  optional duration, paid/currency budget, planning/evaluation timeout fallback,
  and mocked selected-online-resource provenance. Mocked pathway selection is
  not proof that a new live resource was selected. No frontend changes or UI,
  profile, database, matching, full-suite or build checks were needed.
- `git diff --check` passed (line-ending warnings only). Branch KW; no unresolved
  conflicts. Merge head and origin/main remain b9d4e7c. Staged binary-diff hash
  remains 8377630cfeb024270a3267bd52ff175615649098d6a20610ca2f08d43da4ecd7.
  No stage/commit/push/reset/abort; existing uncommitted work preserved.

## Required user action

In Runpod console, verify the local key is valid and has access to the intended
GLM endpoint; update only the local backend environment if needed and restart.
Do not provide the key in chat. Check endpoint Workers (ready/initializing/
unhealthy), queued/in-progress jobs, worker startup/error logs and model/handler
configuration. Compare job arrival/start/completion timestamps and generation
metrics where available. This is required before any further inference test.
No scaling, GPU or deployment setting was changed.

If a healthy worker's measured inference exceeds the synchronous envelope, seek
separate approval for an additive job submit/status API: return a bounded job ID,
poll through the existing shared client, bind results to the evidence fingerprint,
expire/coalesce jobs and retain deterministic content while pending. This adds
job lifecycle and cancellation handling; it is **not implemented or yet proven
necessary**. Increasing current timeouts is not recommended without measurements.

Official health operation reference:
https://github.com/runpod/docs/blob/main/serverless/endpoints/operation-reference.mdx
