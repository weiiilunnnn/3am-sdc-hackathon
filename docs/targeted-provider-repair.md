# Targeted provider repair and bounded retest

## Confirmed causes and fixes

- Career and course-planning diagnostic requests produced categorized client-side
  **timeouts**, at 8.266s and 5.032s. The old shared error discarded this category.
  `runpod_api.py` now retains sanitized category, HTTP status, elapsed time and
  configured timeout. Queue, model JSON, response-schema and truncation failures
  are distinguishable. No raw provider bodies or credentials are logged.
- Career's optional AI deadline is 25s, including consistent in-flight sharing;
  course planning has a 12s cap within the existing overall discovery deadline.
  These are feature-specific changes, not a global Runpod timeout increase.
  Career still timed out at 25.234s, planning at 12.047s and evaluation at 5.031s.
  Endpoint cold start, queue state and generation latency remain unconfirmed:
  a timeout alone cannot distinguish them. No current GLM output was returned.
- Next's installed rewrite proxy defaults to 30s. Discovery plus independent
  certification previously allowed 25+12s. Certifications now receive the same
  absolute request deadline (27s overall), retain local fallback and do not start
  new provider requests once that deadline is exhausted.
- An actual replay of `free normalise data tutorial course` returned Great
  Learning, Class Central, YouTube and SQLCourse: all outside the existing
  reviewed-provider scope. These were correct security rejections. The prior
  eight URLs were not retained and cannot be reconstructed exactly; four new
  public replay records are in `tests/fixtures/tavily_rejected_replay.json`.
- Course and certification searches now pass the **unchanged** reviewed provider
  list via Tavily's documented `include_domains` parameter:
  https://docs.tavily.com/documentation/api-reference/endpoint/search .
  Existing HTTPS/host checks, normalization, redirect policy and source identity
  requirements are not relaxed, and no provider domains were added.
- The repaired search returned four accepted provider URLs; one extraction
  returned four pages. One passed live content verification. Microsoft Sentinel
  and Kaggle lacked literal curriculum evidence for the allowed concepts.
- Google's extracted H1 appended collection controls. This inflated the title
  mismatch denominator. Only Google's observed `Stay organized with collections`
  suffix is removed; the existing 60% title-match check remains unchanged. Local
  replay of the captured page then passed, yielding two evidence-bound pages.
- Both pages have **unknown price/free-access status and unknown duration**. The
  existing planner excludes them; no access claim or price was invented.
- A single compact backend-derived gap count is restored in the existing
  Remaining Learning Gaps area, omitted at zero. Hero and removed panels stay as
  they were. The tested UI displayed `25 gaps still need learning resources`.

## Live outcomes and budget

| Checkpoint | Outcome |
|---|---|
| Career AI / transferable bridges | Unavailable: 25s timeout; no explanations or bridges |
| Course-planning AI | Unavailable: 12s timeout; deterministic query fallback |
| Scoped search / URL acceptance | Four accepted official-provider URLs |
| Extraction | Four pages returned in 1.282s |
| Evidence verification | One live; second passed offline replay after the H1 fix |
| Runpod resource evaluation | Reached, but timed out at 5.031s |
| New online resource displayed | None: unknown access/pricing excluded by unchanged planner |
| Local pathway | Six catalogue courses and local certification retained; 25 uncovered |
| Gap visibility | Dynamic count displayed and matched API |

Usage across diagnosis **and** retest: **5/5 Runpod LLM attempts, 2/2 Tavily
searches, 1/2 extractions**. All five Runpod attempts timed out; both searches
and extraction returned successfully. Tavily reported three credits total.
There were no automatic provider retries. The audit guard blocked excess search
attempts before network I/O; application attempt counters include that blocked
attempt, while the audit ledger counts actual provider calls.

The course-only live test used an isolated SQLite profile and the normal career
and pathway routes in the real frontend. Separate online certification discovery
was excluded from this test's paid scope; actual local-catalogue credentials were
retained. No registration/Home/CV workflow was rerun.

## Verified public provider pages (not selected courses)

- Google: Numerical data: Normalization —
  https://developers.google.com/machine-learning/crash-course/numerical-data/normalization
- Microsoft Learn: Normalize Data component —
  https://learn.microsoft.com/en-us/azure/machine-learning/component-reference/normalize-data?view=azureml-api-2

Both support the existing machine-learning ESCO concept in captured provider
text and are new to the local catalogue. Neither was represented as a free
course, a selected pathway item, or a successful AI evaluation.

## Verification and next step

53 focused backend checks cover client diagnostics, career validation, course
discovery/verification/evaluation, credentials and shared deadlines. Six selected
frontend component checks cover pathway presentation and count omission at zero.
An initial obsolete 8s deadline assertion was updated; a logging-test harness
failure caused by globally disabling logging passed when rerun normally.
No full backend/browser suite or production build was rerun.

**PARTIALLY VERIFIED.** Before spending more credits, inspect the existing
Runpod worker/queue readiness and inference latency. The 25s optional request
limit is already close to the proxy limit; do not keep increasing it. If normal
response latency exceeds that envelope, bounded asynchronous handling requires
a separately reviewed change. Obtain explicit access/pricing evidence or an
eligible priced course before attempting to select an online resource.

## Changed files for this repair

- `src/services/sources/runpod_api.py`, `src/services/sources/tavily_api.py`
- `src/services/future_roles/pathway_llm.py`, `career_analysis.py`,
  `resource_discovery.py`, `resource_verification.py`, `credentials.py`
- `src/frontend/components/PathwayView.tsx`
- `tests/test_runpod_diagnostics.py` (new), `tests/test_career_analysis.py`,
  `tests/test_resource_discovery.py`, `tests/test_credentials.py`,
  `tests/frontend_components.test.ts`
- `tests/fixtures/tavily_rejected_replay.json` (new)
- `docs/future-role-baseline.json` (only the newly approved gap-indicator UI hash)
- This report.

No profile integration, ESCO records/recognition, ranking, matching, deterministic
planner selection/scheduling, navigation, dependency or shared authentication
logic was replaced. Existing pending merge work is preserved. No staging,
commit, reset, abort or push was performed.
