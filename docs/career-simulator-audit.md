# Career Simulator Technical Audit and phase log

## Phase 0 — inspected

Branch KW; existing uncommitted Career Details, retry, discovery, pathway and
theme work is retained. Inputs were supplied in Downloads, not initially in
the repository. Exact copies are now in docs/reference and the handoff in docs.
Both complete references were read (596 and 1,733 lines). Their only imports are
React, Next Link, lucide-react and framer-motion. No local imports, assets,
supporting CSS or license notices were supplied. The original repo need not be
fetched. We independently implement the requested composition and interactions;
no bulk source copying, external images or new dependencies. The user supplied
the references for this adaptation; independent redistribution rights to the
original prototype are not established by the attachments.

CareerLandscape is static: card/arrow composition retained, invented tracks,
profile counts, match/confidence/difficulty metrics and inert sorting discarded.
LifeChapterDesigner supplies horizontal node selection, previous/next controls,
goal modal, editing/removal and selected detail patterns. Financial/readiness/
impact calculators, generated chapter claims, assumed dates/durations, destructive
starting-point reset and pink/navy/Tailwind/motion/icon dependencies are excluded.
Current dark Pathwaay CSS and local SVGs are the visual source of truth.

Integration points: new models/service/router and workspace route; existing
OccupationIndex, data_repository.supported, workspace_profile adapter and SQLite
connection reused. Matching, pathway and paid-provider services are not invoked.
Index loader validation and full coverage are mandatory for new exploration.

Existing profile APIs have no authenticated ownership. The approved local-demo
option is a random 256-bit browser capability with only its hash in SQLite.
Scope is (capability hash, existing profile ID), one plan within that scope.
Different browser capabilities cannot read or overwrite each other's plans.
This protects plan content, not existing unauthenticated profile endpoints;
it is not account authentication. Browser storage loss loses recovery, and XSS
or a compromised shared browser can steal capability access. No auth migration.

No reusable graph/timeline library exists. Lightweight scoped CSS/React supports
the requested interactions; additions avoid all existing feature algorithms.

## Execution log

Phases 1–2: new bounded Pydantic inputs and deterministic engine, read-only reuse
of adapt_workspace_profile, verified role-skill provenance, browser-capability
scoped SQLite table and atomic revisions. Nine backend tests passed against
temporary profiles/databases and the installed full real index. Missing index,
cross-capability access, duplicate first-create, stale revision, input abuse and
non-destructive path reconciliation covered. No evidence assumptions promoted.

Phases 3–4: new route, final navigation link, sourced cards, branching search,
locked/accepted path, horizontal timeline and native-dialog goal/skill/break
editors. Optional dates/relative years/durations and explicit reorder controls;
no preset milestones. Debounced single-flight autosave acknowledges revisions,
keeps drafts on failure/conflict, warns before navigation and exports a review
copy before an explicitly confirmed reload. Seven new component/helper tests,
30 existing component tests and six logic tests passed. TypeScript and initial
production build passed. Browser first attempt hit the default assertion wait
during cold index/hydration loading; local readiness timeout adjusted, retesting.

Phase 5 complete: final simulator suite expanded to 13 passing backend tests.
Focused regression runs passed 74 Career Jobs/discovery/reskilling/API checks
and 12 Role Search/hybrid-profile checks (99 distinct backend checks including
the simulator). Eight simulator frontend tests, all 30 existing component tests
and six existing logic tests passed. TypeScript and final production build passed.

The production browser test passed with the full installed ESCO index and the
existing labelled sample profile copied only into an isolated temporary test
database. It selected data scientist → statistician, unlocked the Designer,
added one documented skill, a custom goal and break, saved/reloaded, backtracked
and reselected a route without losing user entries, and verified persisted content.
A competing revision returned HTTP 409; the next UI edit retained its unsaved
buffer and displayed Conflict. A 390px mobile viewport had no document overflow;
a full-page screenshot was saved in ignored frontend/test-results and inspected.
No generation/pathway/Tavily/Runpod requests were triggered by the browser flow.

Earlier browser attempts exposed cold-dev loading and a select-label locator
problem, then a real autosave defect: server `origin` metadata leaked into strict
milestone edit requests. Fixed using an explicit input-field allowlist and added
the regression assertion. The final production-backed flow passed (one test,
25.8 seconds interaction time). Final production build includes these fixes.

No live provider calls, staging, commits or pushes occurred. KW is unchanged as
the active branch. Existing dirty feature files were not rewritten. Only main.py
(router import/registration) and PathwaayRibbon (one final link) are modified
existing files for this feature; additions are isolated in new modules/routes.
Generated tsconfig entries were removed after verification.

Final hardening: dated milestones use timing-based order with explanatory disabled
manual reorder buttons. Reset/recreate concurrency binds revision writes/deletes
to opaque plan identity; the additional backend regression passes. Final suite
counts are 13 new backend, 86 existing backend, eight new frontend, 30 existing
component and six logic checks. No new application dependencies.

Final production-backed browser rerun after plan-identity hardening passed:
one flow, 29.2 seconds interaction time, saved/reloaded real ESCO route and
user goals/break, HTTP 409 stale-write recovery, no paid requests, no mobile
overflow. Test servers were stopped. TypeScript generation changes are absent
from the final diff; only intentional files remain unstaged on KW.
