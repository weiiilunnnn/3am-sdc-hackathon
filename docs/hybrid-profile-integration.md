# Main + KW shared profile

Main keeps its registration, completed-profile editor and
`sessionStorage["pathwaay.registration-profile"]`. `hybrid-profile.ts` saves a
validated projection and a lossless Main snapshot into the existing SQLite
`profiles.payload`; no second profile database or ESCO recogniser is used.

## Persistence and updates

- `POST /api/profiles` optionally accepts `Idempotency-Key`. Retries return the
  original row without overwriting it. The browser retains a pending creation
  operation until it has remembered the returned profile ID.
- `GET /api/profiles/{id}` restores the raw saved profile and Main snapshot.
- `PUT /api/profiles/{id}` optionally accepts `If-Match` with the last
  `updated_at` revision. A stale revision returns 409. Existing callers without
  that header remain compatible.
- The shared adapter loads before updating, preserves unrelated backend records,
  proficiency and evidence, and uses stable IDs for Main-owned structured records.
- Main-only data (including bounded JPEG photos and original narrative strings)
  stays in the same row's `registration_profile` snapshot. Existing rows without
  snapshots continue using the existing profile editor.
- Returning users with the saved localStorage ID recover the snapshot from
  SQLite. Missing IDs are not guessed; failed/stale lookups do not automatically
  create replacement profiles. A deliberate new registration creates a profile
  only when no saved identity exists.
- Browser storage failures or unavailable APIs are reported; successful database
  persistence is distinguished from an optional matching-cache refresh.

## Meaning and recognition

User-entered profiles have `synthetic_demo: false`; existing synthetic samples
remain true. Missing proficiency is `unknown`, and missing experience is null.
Education and learning-mode enums are mapped from explicit Main choices, never
inferred from names or narrative text. Invalid or over-limit fields are rejected,
not truncated. Full narrative text is retained in the snapshot.

`GET /api/v2/profiles/{id}` still calls `adapt_workspace_profile()` against the
pinned ESCO index. Python resolves to Python (computer programming), SQL remains
ambiguous/unresolved, and Data Analysis currently resolves to statistics through
the existing aliases. Scores, qualification, ESCO data, pathway planning and
Runpod/Tavily transport are unchanged. Only synthetic response metadata changes.

## Limits

This remains a **local-device prototype without authenticated account ownership**.
A remembered profile ID is a continuity reference, not authentication. Existing
profile endpoints are not suitable for public multi-user personal-data hosting
until ownership/authentication is implemented. Clearing localStorage removes
automatic recovery, although the SQLite record remains. No cross-device account
recovery is claimed.

Session drafts remain on backend save failure. Reloading a profile whose server
revision has changed restores the saved server snapshot; do not use reload to
retain unsaved edits. Legacy non-hybrid API clients may omit revision checks.

The existing byte-baseline fixture was refreshed only for the approved Pathway
UI cleanup and truthful synthetic metadata. Planner selection/timing logic was
not changed.

## Integration file inventory

- Shared frontend adapter: `src/frontend/lib/hybrid-profile.ts` (new).
- Main save/recovery hooks: `src/frontend/app/(pathwaay)/register/page.tsx`,
  `src/frontend/app/(workspace)/profile/page.tsx`,
  `src/frontend/app/(workspace)/profile/edit/page.tsx`, and
  `src/frontend/app/(workspace)/profile/CompletedProfile.tsx`.
- Navigation: `src/frontend/app/(workspace)/AppShell.tsx` and
  `src/frontend/app/PathwaayRibbon.tsx`.
- Shared frontend contracts and round trips: `src/frontend/lib/api.ts`,
  `src/frontend/lib/contracts.ts`, `src/frontend/lib/profile-validation.ts`,
  `src/frontend/app/(workspace)/profile-workspace.ts`.
- Truthful saved-profile wording: `src/frontend/app/(workspace)/home/page.tsx`,
  `src/frontend/app/(workspace)/cv-studio/page.tsx`,
  `src/services/profile_insights.py`.
- Backend persistence/contracts: `src/models/profiles.py`,
  `src/models/future_roles.py`, `src/api/profiles.py`,
  `src/services/profile_service.py`.
- Response metadata only: `src/services/future_roles/future_role_matching.py`,
  `src/services/future_roles/personalized_reskilling.py`.
- Tests: `tests/test_hybrid_profiles.py` (new), `tests/test_profiles.py`,
  `tests/test_api.py`, `tests/test_contracts.py`, `tests/test_future_roles_api.py`,
  `tests/frontend_components.test.ts`, `tests/frontend_logic.test.mjs`,
  `src/frontend/e2e/hybrid-profile.spec.ts` (new),
  `src/frontend/e2e/branch-integration.spec.ts`.
- Verification fixture/cache hygiene: `docs/future-role-baseline.json`,
  `.gitignore` (isolated production build output).

The incoming `src/main.py`, workspace layout/CSS, dataset and career-model
changes were retained without further edits for this integration.
