# SH into KW ? review before merge commit

UI checkpoint: 511d509410cef33f0a228ab4e5b41ab1bd37227c
Incoming SH: 9cbb69022dd917ae9b52e313e9e7eea8ea6ac8c8.
Merge requested with --no-ff --no-commit. Remains uncommitted on KW; no push.

## Incorporated SH functionality

AI Trend Signal V5 at /signals; session-profile skill connections, source-grounded
Runpod reviews/explanations, OpenAlex research observations, Himalayas/Remote OK
source adapters, evidence extraction/history, background discovery/budgeting and
DOSM context services. Additive SQLite tables retain the existing profiles table
and database path. No refresh script or live ingestion was executed.

SH intentionally consolidates /explore, /outlook and /radar into redirects to
/signals. Its new ribbon links include AI Trend Signal, while KW's Role Matching
link and Main profile/CV/Home/Career Demo navigation remain. Existing underlying
employment/research APIs are retained. No duplicate navigation was introduced.

## Resolution and preservation

Only requirements.txt conflicted: retain python-dotenv>=1.0,<2.0 and
openpyxl>=3.1,<4.0. The latter is required by SH's DOSM XLSX parser and was
installed into the existing virtual environment; no other dependency updated.
Home and ribbon auto-merged and were inspected. No application logic edits were
needed. One incoming whitespace-only line in storage.py was cleaned. All files under the three Future-Ready routes, dark CSS, hybrid adapter,
profile persistence, recognition/matching, deterministic planner, resource
verification, shared Runpod client and Tavily client match the UI checkpoint.
The intentionally removed profile/unresolved-skills notices remain removed.

## Focused verification actually run

- TypeScript: PASS.
- Production build: PASS, including /signals and all three feature routes.
- 25 backend tests PASS: session signal adapter/review/Runpod, hybrid profile and
  Runpod diagnostics. Tests used temporary SQLite, explicit empty provider keys,
  EVIDENCE_LLM_ENABLED=0 and a failing external-network stub. Model success cases
  were mocks, not live-provider claims.
- Seven selected frontend component checks PASS: hybrid metadata/preservation,
  profile loading, pathway origins and career fallback/rendering.
- Three isolated ASGI checks PASS (HTTP200): session-connections,
  session-explanation (disabled), explore-ai-skills (empty local evidence).
- Protected-file comparison, working and staged whitespace checks PASS.
- No full browser workflow or unrelated full test suites repeated.
- Next's build-generated tsconfig includes were removed; output remains ignored.

## Remaining risks / limitations

Live evidence refresh and paid Runpod behaviour were intentionally not tested.
Existing Runpod401/timeouts/endpoint confirmation remain unresolved. SH's new
model budget/enabled settings remain as authored; no account/configuration
changes were made. New evidence pages may be empty until evidence is refreshed.
The DOSM workbook parser dependency is installed but an actual downloaded workbook
was not fetched/validated in this merge. Session-based signal views consume the
existing registration snapshot; after browser session loss, visiting Profile
restores that snapshot from SQLite through the existing hybrid flow. Logout is
still a local demo session action, not authenticated ownership.

## Pending merge files relative to UI checkpoint

- `requirements.txt`
- `scripts/refresh_ai_trend_evidence.py`
- `src/api/trends.py`
- `src/data/ai_capabilities.py`
- `src/data/himalayas_source.py`
- `src/data/signal_contexts.py`
- `src/data/signal_employment_source.py`
- `src/frontend/app/(workspace)/AITrendSignalExperience.tsx`
- `src/frontend/app/(workspace)/ai-trend-signal.css`
- `src/frontend/app/(workspace)/explore/page.tsx`
- `src/frontend/app/(workspace)/home/page.tsx`
- `src/frontend/app/(workspace)/outlook/page.tsx`
- `src/frontend/app/(workspace)/radar/page.tsx`
- `src/frontend/app/(workspace)/signals/ai-trend-signal.css`
- `src/frontend/app/(workspace)/signals/ai-trend-v5.css`
- `src/frontend/app/(workspace)/signals/page.tsx`
- `src/frontend/app/(workspace)/signals/trend-signals.css`
- `src/frontend/app/PathwaayRibbon.tsx`
- `src/models/signal_employment.py`
- `src/services/ai_skill_exploration.py`
- `src/services/connection_jobs.py`
- `src/services/connection_model.py`
- `src/services/dosm_service.py`
- `src/services/evidence_refresh.py`
- `src/services/profile_signal_guidance.py`
- `src/services/radar_brief.py`
- `src/services/session_signal_adapter.py`
- `src/services/session_signal_review.py`
- `src/services/session_signal_runpod.py`
- `src/services/signal_employment_service.py`
- `src/services/signal_explanations.py`
- `src/services/signal_findings.py`
- `src/services/signal_model_budget.py`
- `src/services/skill_connection_experience.py`
- `src/services/skill_connections.py`
- `src/services/sources/himalayas.py`
- `src/services/sources/signal_remoteok.py`
- `src/services/storage.py`
- `src/services/trend_experience.py`
- `tests/test_session_signal_adapter.py`
- `tests/test_session_signal_review.py`
- `tests/test_session_signal_runpod.py`
- `docs/sh-merge-review.md` (this report, untracked)
