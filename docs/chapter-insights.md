# Optional Goal and Skill insights

The chapter details card starts with deterministic local guidance. A user must
explicitly press Generate insights to submit generation. Selection and page
loads call only the local cache endpoint; polling resumes an existing request.
The UI states that chapter title, notes and nearby occupation titles are sent
to the shared Runpod model. No full profile, CV or credentials enter the prompt.

The existing shared runpod_api submit/job_status methods and pathway_llm request
builder/parser are reused, using GLM-5.3, temperature 0.2, up to 700 output tokens,
and RUNPOD_LLM_ENDPOINT_ID or sdg_text.LLM_ENDPOINT_ID. There is no new HTTP client,
Random Forest integration, authentication path, frontend key or Tavily call.

## Context, evidence and wording

The backend reads the capability-owned saved SQLite plan, reconstructs its
anchored chapter order and takes nearby career titles. Goals use the user's
actual goal title and notes without assuming motivations or personal facts.
Skills require an intact, verified ESCO relationship, with its canonical skill,
occupation, source IDs, release and source URLs kept separate from model prose.
Changed or removed skill evidence blocks generation pending review.

Generated JSON has why_relevant, practice, evidence_of_learning, evidence_id and
evidence_quote only. The quote/ID must exactly match the supplied basis, while
all explanatory text passes the existing Career Details conditional-wording
validator. Personal assertions, email-like content, unsupported sources, URLs,
proficiency claims and guaranteed outcomes are rejected. Suggestions are AI
interpretations rather than new ESCO facts or mastery assessments. Source
quotations retain original spelling; displayed skill labels use the existing
Title Case formatter without changing the canonical ESCO labels or identifiers.

## Async lifecycle and cache

POST /api/v2/career-simulator/insights/cache reads existing state without
submitting. POST /insights/jobs explicitly reserves and submits a job once.
POST /insights/jobs/status checks only that job. All three use the existing
X-Career-Simulator-Key capability and a saved profile/milestone ID. Status
requests reject a changed chapter context or another capability's job.

chapter_insight_jobs is an additive table in the existing SQLite database;
there is no duplicate profile database. It stores hashed scoped context, local
and remote job metadata, and validated output. No raw prompt, profile or chapter-notes snapshot or provider error body is
stored in this job table or logs. Validated suggestions may reflect the supplied
notes. Existing user notes remain in their original plan storage.

Completed output is reused for six hours. The fingerprint includes chapter
kind/title/notes, nearby role IDs/titles, verified evidence, index fingerprint,
endpoint and the validation-contract version. The wording-only prompt clarification
retains this version so existing validated results remain reusable. Changed context
needs a new explicit request. Jobs and provider policy are bounded to five minutes;
uncertain attempts cannot be explicitly resubmitted until their lifetime plus five
seconds ends. Confirmed completed output failures and confirmed terminal provider
failures can be retried immediately with retry_failed=true. A plain lookup/start
does not retry them. Active requests and successful caches remain deduplicated.
There are no automatic retries. A polling lease limits status calls to one per
eight seconds, with at most sixteen active and 256 retained jobs. Old records
are pruned. Valid cached output remains available without provider credentials.

## Failure diagnosis and explicit recovery

The observed legacy invalid_grounding row proves a completed response was rejected,
but its discarded exception cannot identify the old wording/evidence violation.
New failures distinguish invalid_wording, unsupported_personal_assertion,
invalid_evidence_reference, invalid_schema and invalid_output. Logs record only
the local job ID, safe category, explanatory field name and exception class.
No model output, user notes, credentials or exception input values are logged.
The prompt now explicitly prohibits the same personal-assertion phrases checked
by validation. All three prose fields retain the conditional-wording guard;
evidence quotations remain verbatim. The frontend explains the failure and offers
Retry insights only as an explicit user action. No live provider test was made
for this repair; mocked tests cannot guarantee future model compliance.

Missing credentials, unavailable providers, expired jobs and invalid outputs
leave local guidance and verified source links available. Failures log only a
local job ID, safe category and exception class. The frontend aborts stale
lookups/polls and ignores late generation responses when chapter context changes.
Save and evidence-review gates prevent generation from unsaved/flagged data.

## Local use and limits

Use the existing npm run dev command and repository-root .env configuration.
No new key is required: use the existing RUNPOD_API_KEY and optional
RUNPOD_LLM_ENDPOINT_ID. No new live provider requests were authorised or executed
while implementing this feature. Model usefulness and provider readiness remain
to be verified by a separately authorised live test. Strict validation may
reject model prose; local guidance remains the honest fallback. Goal insights
are suggestions based on the supplied chapter context, not inferred personal
motivation or a financial, medical or career-readiness assessment.


Verification: thirteen new mocked backend tests and fifteen existing simulator
regressions passed. Twenty focused frontend tests, TypeScript and production
build passed. The isolated real-ESCO browser workflow passed with mocked
provider availability/output: no submissions on chapter selection, one explicit
submission, polling, AI labelling, cached reuse on reload and unchanged chapter,
path, conflict and mobile behaviour. No live Runpod/Tavily calls were made.
