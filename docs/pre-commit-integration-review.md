# Main + KW final pre-commit review (2026-10-23)

Result: ready for an explicitly approved staging-and-merge-commit step, with
known live-provider limitations. The current index alone is NOT the complete
integration: required modified and untracked files listed below must be included
when staging is authorized. No staging or commit was performed by this review.

## Preservation and scope

- KW remains checked out; merge head and origin/main are b9d4e7c. No unresolved
  index entries or source conflict markers. Existing staged index unchanged.
- Main root redirects to /register; route groups, shared PathwaayRibbon, profile,
  Home, CV Studio and other navigation preserved. KW Role Matching link occurs
  once in the shared navigation and remains active on nested feature pages.
- Registration and editing retain Main UI/session storage, adding the shared
  hybrid adapter to the existing profile API/SQLite row. Idempotent creation,
  revision-checked updates, preserved evidence and saved-profile recovery remain.
- Production build includes /role-matching, /role-matching/roles/[roleId] and
  /role-matching/roles/[roleId]/pathway. Matching and planner diffs change only
  truthful synthetic metadata, not scoring/selection/scheduling algorithms.
- Incoming synthetic CSV (2,880 explicitly synthetic rows), generator and
  career-model feature projection belong to main and are retained, not audit
  artifacts. No dependency changes or UI redesign were introduced by this review.
- Provider repairs include shared sanitized errors and health diagnostics,
  bounded deadlines, provider-scoped Tavily queries, Google heading parsing,
  strict access evidence and dynamic uncovered-gap count, with tests/reports.

## Validation actually executed

- npm --prefix src/frontend run typecheck: PASS.
- NEXT_DIST_DIR=.next-merge-check npm --prefix src/frontend run build: PASS,
  including production TypeScript and all 15 static pages plus dynamic routes.
  Build output is ignored. Next's temporary tsconfig additions were removed;
  tsconfig has no pending change.
- unittest test_hybrid_profiles + test_runpod_diagnostics: 10 PASS.
- Selected CareerAnalysisTests (2) and ResourceDiscoveryTests (7): 9 PASS.
- Frontend test:logic: 6 PASS (nonblocking Node module-type warning).
- Selected component checks: origins, profile recovery, credentials and career
  AI fallback: 4 PASS.
- git diff --check: PASS (Git line-ending warnings only).
- No live APIs, full browser E2E, full backend suite or Runpod repair attempted.

## Security and remaining limitations

Pending content was scanned locally for common Runpod/Tavily/OpenAI key formats,
private-key headers and conflict markers: none found. This pattern scan is not a
formal guarantee against every possible secret format. Git tracks no .env,
SQLite/database or log artifacts; .env and local SQLite are ignored. Untracked
files are only the integration adapter, tests, public replay fixture and reports.
No temporary provider-response files remain in the pending set. Runtime .next
outputs are ignored and must not be force-added. Backend credentials are not
NEXT_PUBLIC values.

Runpod root key presence is confirmed, but validity is NOT. The previous health
request returned HTTP 401 in 0.657s. Earlier Career/planning/evaluation requests
hit 25s/12s/5s client deadlines. Worker readiness, queueing, deployed handler and
actual inference time remain unobserved. Teammate confirmation of intended GLM
endpoint and API-key permissions is pending. No provider setting was changed.
Live AI explanations/bridges and online resource evaluation are not verified.
Unknown access/pricing pages correctly remain excluded; deterministic Career
Details and local resources retain their tested fallback. This limits feature
availability but does not block preserving the tested integration in Git.

Profiles remain a local-device prototype without authenticated ownership or
cross-device recovery. Browser storage clearing removes automatic continuity.
Prior full workflow results are recorded separately; they were not rerun here.

## Exact proposed inclusion list (relative to KW HEAD)

These files comprise incoming main changes plus approved hybrid/provider work.
Existing KW feature commits are already in HEAD and remain in merge history.
Do not commit only the current staged subset.

- `.gitignore`
- `data/README.md`
- `data/unified_profile_career_dataset.csv`
- `docs/focused-provider-readiness.md`
- `docs/future-role-baseline.json`
- `docs/hybrid-profile-integration.md`
- `docs/pre-commit-integration-review.md`
- `docs/targeted-provider-repair.md`
- `scripts/generate_synthetic_data.mjs`
- `src/api/profiles.py`
- `src/frontend/app/(pathwaay)/explorer/page.tsx`
- `src/frontend/app/(pathwaay)/globals.css`
- `src/frontend/app/(pathwaay)/layout.tsx`
- `src/frontend/app/(pathwaay)/login/page.tsx`
- `src/frontend/app/(pathwaay)/register/page.tsx`
- `src/frontend/app/(workspace)/AppShell.tsx`
- `src/frontend/app/(workspace)/cv-studio/page.tsx`
- `src/frontend/app/(workspace)/globals.css`
- `src/frontend/app/(workspace)/home/page.tsx`
- `src/frontend/app/(workspace)/layout.tsx`
- `src/frontend/app/(workspace)/profile-workspace.ts`
- `src/frontend/app/(workspace)/profile/CompletedProfile.tsx`
- `src/frontend/app/(workspace)/profile/edit/page.tsx`
- `src/frontend/app/(workspace)/profile/page.tsx`
- `src/frontend/app/PathwaayRibbon.tsx`
- `src/frontend/app/pathwaay-ribbon.css`
- `src/frontend/components/PathwayView.tsx`
- `src/frontend/e2e/branch-integration.spec.ts`
- `src/frontend/e2e/hybrid-profile.spec.ts`
- `src/frontend/lib/api.ts`
- `src/frontend/lib/contracts.ts`
- `src/frontend/lib/hybrid-profile.ts`
- `src/frontend/lib/pathwaay-profile.ts`
- `src/frontend/lib/profile-validation.ts`
- `src/main.py`
- `src/models/future_roles.py`
- `src/models/profiles.py`
- `src/services/career_model.py`
- `src/services/future_roles/career_analysis.py`
- `src/services/future_roles/credentials.py`
- `src/services/future_roles/future_role_matching.py`
- `src/services/future_roles/pathway_llm.py`
- `src/services/future_roles/personalized_reskilling.py`
- `src/services/future_roles/resource_discovery.py`
- `src/services/future_roles/resource_verification.py`
- `src/services/profile_insights.py`
- `src/services/profile_service.py`
- `src/services/sources/runpod_api.py`
- `src/services/sources/tavily_api.py`
- `tests/fixtures/tavily_rejected_replay.json`
- `tests/frontend_components.test.ts`
- `tests/frontend_logic.test.mjs`
- `tests/test_api.py`
- `tests/test_career_analysis.py`
- `tests/test_contracts.py`
- `tests/test_credentials.py`
- `tests/test_future_roles_api.py`
- `tests/test_hybrid_profiles.py`
- `tests/test_profiles.py`
- `tests/test_resource_discovery.py`
- `tests/test_runpod_diagnostics.py`
