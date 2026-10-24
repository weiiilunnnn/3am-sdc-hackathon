# Latest main into KW ? uncommitted review (2026-10-23)

KW HEAD remains c19f5ba; pending merge is e92a05d (includes 5703e55).
No commit/push/reset/abort or remote modification performed. Only six conflict
resolutions were explicitly staged; other automatically staged incoming files
and unstaged compatibility additions remain for review. No unresolved conflicts.
The old tsconfig warning was verified content-identical and normalized before
merging; build-generated tsconfig includes were removed after verification.

## Incoming changes retained

Main's expanded onboarding/AI review, completed-profile editing, email and local
taxonomy display links, Home and CV Studio session-profile previews, shared
styles/navigation/logout, extraction API/models/services, Runpod configuration
errors and synthetic evaluation data are incorporated. Role Matching link and
all three existing KW pages remain. Root redirect and route groups unchanged.

## Six conflicts

- register/page.tsx: preserve Main's nine-step AI-review/skip/focus workflow;
  final async advance uses KW's in-flight guard and SQLite save before navigation.
- cv-studio/page.tsx: Main's registration-profile preview and reusable template
  controls, with backend-only profile fallback and truthful saved-profile wording.
- home/page.tsx: Main's registration overview plus existing backend-only fallback.
- profile/page.tsx: retain KW's complete recovery/compatibility wrapper and legacy
  editor rather than Main's session-only replacement. Both render the newly
  merged Main CompletedProfile for registration snapshots; no duplicate workflow.
- runpod_api.py: combine Main's ConfigurationError/status-specific sanitized
  messages with KW's shared health/POST transport, error categories, elapsed
  timing and queue/output normalization. No deadline or endpoint repair.
- frontend_components.test.ts: combine the equivalent loading-state assertion
  with Main's additional assertion that the legacy save form is absent initially.

## Minimal contract adaptations

RegistrationProfile stores bounded optional email and skillLinks in the existing
SQLite payload. These links are display metadata, never trusted as ESCO IDs.
Hybrid remember emits Main's profile-updated event so Home/CV observers refresh.
Skill extractor's blank override now falls back to the same shared GLM default.
Existing API compatibility and genuine/unknown profile handling remain intact.

## Extraction semantics

Registration explicitly collects work descriptions, education/coursework,
volunteering, projects, training, achievements, activities, strengths and summary.
It excludes email, interests and aspirations as proof. User consent triggers
POST /api/profiles/extract-profile-skills. The model returns canonical ESCO IDs,
exact evidence quotes, reasons and source references; backend rejects unknown
IDs/nonliteral quotes. UI suggestions start unselected and require review, check
for stale evidence, append to the registration skills and deduplicate by ESCO
ID. Candidate IDs come from the pinned full ESCO v1.2.1 snapshot, are validated
again by the SQLite profile API, and are passed directly to the KW adapter.
The request sends only a bounded, locally retrieved set of relevant taxonomy
entries; it does not call the ESCO API or send the full catalogue.
Ambiguous SQL remains unresolved. No second recognizer/database was introduced.
The evidence quote is shown for review; Main's saved skillLinks do not persist
those quotes as a separate evidence store. Existing backend evidence is retained.
CV PDF/DOCX parsing remains deterministic/in-memory; the new profile-description
AI endpoint is separate, not an automatic AI call on every CV upload. CV Studio
renders registration/saved content; it does not fabricate new CV content.

## Verification

- TypeScript PASS (after resolving merge omissions; final rerun also PASS).
- Production build PASS; all three KW routes present; output ignored.
- 27 backend tests PASS: hybrid, extractor, both shared Runpod test modules,
  CV parser and synthetic generator; includes three new compatibility cases.
- 9 API checks PASS: CV consent/extraction, AI extraction consent/contracts and
  existing Role Matching API tests. An initial invocation used the wrong test
  class name; corrected. Initial CV module typo similarly corrected.
- Important test isolation issue: Role Matching tests inherited root credentials
  and attempted provider transport; these returned transport errors, no successful
  provider response observed. No inference success/credit usage was established.
  Test fixture now explicitly disables dynamic discovery and blanks provider keys;
  two targeted API checks passed again with that isolation. No deliberate live
  retest or escalated provider-network access was used.
- Six selected frontend checks PASS: three hybrid metadata/preservation checks,
  profile loading, pathway origins and deterministic career fallback.
- 25,000 compressed synthetic profiles and 25,000 separate target rows checked;
  both SHA256 hashes match manifest and all profiles explicitly synthetic.
- No matching/planner code diff against KW HEAD; no ESCO index changes.
- Both cached and working whitespace checks PASS. No full browser E2E repeated.

## Remaining limits

RunPod health HTTP401 and teammate endpoint/key confirmation were previously
reported and remain configuration-dependent. Extraction runs as a transient,
bounded background job with a 90-second provider deadline; the frontend polls
for completion and receives explicit provider failures. No live RunPod request
was used to verify the configured endpoint or credentials.
Logout is a demo session action, not authenticated ownership; persisted profile
and local continuity reference remain. Re-entering Profile can restore them.
Backend limits still reject over40 selected skills; no silent truncation added.

## Exact pending file list relative to KW HEAD

- `data/README.md`
- `data/synthetic/kw_profile_dataset_v1.manifest.json`
- `data/synthetic/kw_profile_targets_v1.csv`
- `data/synthetic/kw_profiles_v1.jsonl.gz`
- `docs/architecture.md`
- `docs/testing.md`
- `scripts/generate_kw_synthetic_profiles.py`
- `src/api/cv.py`
- `src/frontend/app/(pathwaay)/globals.css`
- `src/frontend/app/(pathwaay)/login/page.tsx`
- `src/frontend/app/(pathwaay)/register/page.tsx`
- `src/frontend/app/(workspace)/WorkspaceStates.tsx`
- `src/frontend/app/(workspace)/cv-studio/page.tsx`
- `src/frontend/app/(workspace)/explore/page.tsx`
- `src/frontend/app/(workspace)/globals.css`
- `src/frontend/app/(workspace)/home/page.tsx`
- `src/frontend/app/(workspace)/outlook/page.tsx`
- `src/frontend/app/(workspace)/profile-workspace.ts`
- `src/frontend/app/(workspace)/profile/CompletedProfile.tsx`
- `src/frontend/app/PathwaayRibbon.tsx`
- `src/frontend/app/pathwaay-ribbon.css`
- `src/frontend/lib/api.ts`
- `src/frontend/lib/hybrid-profile.ts`
- `src/frontend/lib/pathwaay-profile.ts`
- `src/models/cv.py`
- `src/models/profiles.py`
- `src/services/cv_extractor.py`
- `src/services/skill_extractor.py`
- `src/services/sources/runpod_api.py`
- `tests/frontend_components.test.ts`
- `tests/test_api.py`
- `tests/test_future_roles_api.py`
- `tests/test_hybrid_profiles.py`
- `tests/test_kw_synthetic_profiles.py`
- `tests/test_runpod_api.py`
- `tests/test_skill_extractor.py`
- `docs/latest-main-merge-review.md`
