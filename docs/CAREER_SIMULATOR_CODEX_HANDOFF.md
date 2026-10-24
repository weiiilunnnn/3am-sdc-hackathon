# Pathwaay — AI Career Transition Simulator
## Complete Codex Implementation Handoff (Career Landscape + Life Chapter Designer)

**Document status:** Revised implementation specification / handoff; **reference TSX files now inspected**  
**Project:** `weiiilunnnn/3am-sdc-hackathon`  
**Working branch:** `KW` (use the **current local working tree**, including uncommitted work)  
**Reference repository:** `https://github.com/weiiilunnnn/careerosprototype` (GitHub access not necessary when attached sources are provided)  
**Reference components supplied and inspected:** `CareerLandscape.tsx` (596 source lines) and `LifeChapterDesigner.tsx` (1,733 source lines). Include these exact attachments in Codex’s workspace; they are **design/interaction references**, not production data sources.  
**Prepared:** 24 October 2026 · **Updated after source review and user decisions**  
**Feature name:** **AI Career Transition Simulator**  
**New route:** `/career-simulator`

> **Codex, read this document in full AND inspect both attached reference TSX files before changing code.** Its two and only two top-level sections are **Career Landscape** and **Life Chapter Designer**. Treat original hardcoded career trajectories, benchmark numbers, milestone years, preset readiness metrics, financial calculators and return-to-work forecasts as **reference-only examples that must not be shipped as factual content**. No what-if calculator, invented career histories, fabricated occupations or unsourced predictions.

---

## 0. Implementation authority and current uncertainties

### Confirmed product decisions

1. Create a **new standalone Career Simulator page** inside the existing Pathwaay workspace, not a separate application or competing visual theme.
2. Add **Career Simulator as the final item in the primary employee/user navigation header**, after Role Matching. Do not append it to the employer navigation unless an existing convention requires otherwise.
3. Place the **Career Landscape on top** and **Life Chapter Designer below**, vertically on the same page.
4. Users click to explore and select an **evidence-grounded, exploratory career path**.
5. The lower Life Chapter Designer is **locked until a career path is selected**, then unlocks without navigating away.
6. Life Chapter Designer includes the horizontal timeline and editable **skills, goals, and breaks**, following the reference design/behaviour as far as the source permits.
7. Save the chosen path, timeline, goals, skill milestones and breaks, then **restore them across page revisits and reloads**. **Exactly one saved career journey per existing profile**; no multiple-plan management, separate drafts, or journey-switching UI.
8. **Use real, attributable occupational and skill information**. User-authored plans are user data; do not invent external facts.
9. Reuse current Pathwaay **visual identity, fonts, layout and patterns**.
10. **Exclude** proposed what-if sliders, predictive time-to-employment calculations, simulated life events, salary forecasts, hiring probabilities and automatic assumptions about promotions.
11. Do not call Tavily or Runpod merely to open/operate this new page. Existing evidence-backed learning resources can be surfaced on explicit user action, if appropriate; avoid unrequested provider calls.
12. Preserve all existing uncommitted `KW` changes. **No commit, push, merge or destructive reset** without explicit user approval.
13. User approved **a small configurable maximum path length, not a hardcoded example path**: default **one starting occupation + up to three destination-role steps**. Changes to the cap must be made in one canonical configuration with both client and server enforcement; the number is a UX constraint, not evidence of career development.

### Attached reference-source status — confirmed

The user has supplied both requested sources in this chat. They have been inspected:

- **`CareerLandscape.tsx`**, 596 lines, React/Next.js component.
- **`LifeChapterDesigner.tsx`**, 1,733 lines, client-side React component.

**Important:** The repository URL for `careerosprototype` was inaccessible via GitHub, but the **original uploaded TSX file contents are accessible and were inspected**. Do not repeat the prior claim that the reference code is unavailable. When running Codex, ensure the user **also attaches/copies both TSX files into Codex’s accessible workspace** (for example, `docs/reference/CareerLandscape.tsx` and `docs/reference/LifeChapterDesigner.tsx`). The paths are suggested input staging locations, **not existing project paths**; do not mistake them for production components. Do not alter these supplied references when porting.

Before implementation, Codex must inspect the two source files in full, follow every import, check the local styles/assets required, inspect reference licensing/copying permissions, and document deviations. If supporting original CSS/animations are absent, reconstruct **the interaction and layout** with existing Pathwaay styles rather than pretending pixel-perfect equivalence. The reference source contains no trustworthy real-data backend/persistence contract; build these integrations explicitly.

### Verified component behaviour: CareerLandscape.tsx

The supplied file is a **static showcase** rather than an interactive branching simulator:

- `trajectories` (near lines 34–83) hardcodes three example tracks: BI Analyst, Business Analysis and Product Operations. Each has fabricated illustrative `match`, `profiles`, `difficulty` and `steps` values. **Discard these values**.
- `matchSignals` (near lines 85–106) includes claims about comparing candidate education, projects, experience and transition histories, without a proven supporting data pipeline in the reference. **Do not repeat those claims**.
- `SectionCard`, `ProgressRing`, `TrajectoryCard` provide a useful visual composition: rounded cards, highlighted trajectory badges, horizontal step cards, connector arrows and right-side metrics (near lines 108–291). **Adapt the layout** for dynamic sourced data.
- The select control for sorting (near lines 443–459) is not wired to actual React state/sorting. It must either be implemented with **real supported sorting** or removed; no decorative nonworking controls.
- Links to `/?view=deep-dive` and `/?view=career-path-simulator` assume the other prototype's routing and must be replaced with Pathwaay actions/routes.
- Hero statistics such as `9,842` profiles, `87%` confidence and “2 days ago” (near lines 340–378), and text like “ranked by career progression confidence” or “real candidate journeys” are **unsourced placeholder claims; never carry over**.
- There is **no saved path, no role-node click-selection state, and no real career-transition evidence** in the file. Codex must **build the clickable selection flow** from the agreed product specification, borrowing the visual step layout only.
- Unsplash hero image and original rose/navy palette/font are reference decoration, not Pathwaay data or design authority. Don't automatically fetch external images or import a conflicting theme.

### Verified component behaviour: LifeChapterDesigner.tsx

This file **does** include meaningful interactive timeline patterns, but mixes them with hardcoded examples and extra calculators:

- `careerTemplates` (near lines 99–150) provides **hardcoded career paths and relative years** for student/fresh graduate, UX, data analyst and marketing examples. **Replace entirely** with the real user-selected ESCO role path. Never assume that a career move takes one, three, five or eight years.
- `lifeGoalOptions` (near lines 152–165) offers **reusable, optional user-selectable life-goal categories** (study, family, career break, relocation, hobbies, etc.). These are **UI choice labels**, not observations about the user; they may be retained after Pathwaay restyling, and nothing is created until the user actually chooses it.
- `TimelineNode`, `createLifeNode`, `sortTimelineNodes`, `TimelineNodeItem` (near lines 52–62, 218–238, 324–401) provide the horizontal career/life milestone structure, circular icons, selected-state animation and year labels. **Reuse the interaction pattern** but use stable serializable IDs and user-controlled timing; add first-class ESCO-linked skill milestones.
- `AddLifeGoalModal` (near lines 402–668) supports multi-select predefined life goals, custom goal text, target-year input, editing titles/types/durations and duplicate checks. **Port this UX**; also add a clearly distinct `Add documented skill` and `Add break` flow.
- The main component (near lines 1494–1732) supports previous/next timeline navigation, selecting individual nodes, horizontally scrolling the timeline, add/edit/remove confirmation, and a selected chapter detail card. **These are core behaviours to port**. There is no API/localStorage persistence in the supplied file.
- **Important destructive reference behaviour:** `changeStartingPoint()` (near lines 1524–1527) clears all life nodes. **Do not copy this**. Path changes must preserve user goals/breaks and mark removed-role skill items for review.
- `careerPlans`, `lifePlans`, `getCareerPlan()`, `getLifePlan()` (near lines 167–307) contain template-generated claims about future work, skills, risk, outcomes, evidence and recommended next actions. **Do not treat these as sourced facts.** Replace career detail text with actual role/skill/source evidence; life-goal details should be user-authored or explicitly labelled general prompts, with no unsupported prediction.
- Default life goal durations (`getDefaultDurationMonths()`, near lines 244–262) set assumed month lengths. Do not silently add these as factual/user-approved commitments. Require user selection/input, or clearly identify any uncommitted UI starting value and obtain confirmation.
- `CareerImpactAnalysis`, `getCareerImpactProfile`, `FinancialReadinessCalculator` and `ReturnToWorkReadinessAssessment` (near lines 1062–1432) include **unsupported risk/benefit scores, preset RM financial values, readiness status, and computed return-to-work timetables**. They are **out of scope**, because the owner explicitly rejected what-if simulation and unsourced predictions. **Do not port these functions, numbers, calculators, confidence metrics, financial estimates or forecast language.** Keep the selected-chapter detail panel, replacing these with documented skills, user notes and selected goals/breaks.
- The timeline's progress-fill and “Selected progress” refer to **which node is being viewed**; this is not career completion or readiness. Rename/accessibly label e.g. `Viewing milestone 2 of 5` and never treat it as measured career progress.
- `TimelineNode.icon?: LucideIcon` is a React component reference and **cannot be stored as JSON**. Persist a safe enum `icon_key` or chapter-kind and resolve it through an approved local icon map at render time.
- Original imports include `framer-motion`, `lucide-react` and Tailwind-style utility classes. The checked Pathwaay frontend package does **not** list these packages. Prefer existing Pathwaay SVG/icons/CSS animations and current styles; **do not silently add Tailwind, Framer Motion or lucide-react**. If adopting a dependency is unavoidable, justify compatibility, bundle size and approval; never paste TSX into Pathwaay assuming it will compile unchanged.

### Component adaptation checklist — source to new feature

| Reference pattern | Action in Pathwaay | Evidence guarantee |
|---|---|---|
| CareerLandscape trajectory cards + connector arrows | Make each destination card a clickable branching choice, then render selected route steps | Role IDs/titles/requirements from pinned verified ESCO index |
| CareerLandscape match circle | Replace invented match/confidence with source-backed `shared essential skills` count; optional defined overlap metric | Show calculation and ESCO source; never infer hiring probability |
| Hero “similar profiles”, “confidence”, “portfolio freshness” | **Remove unless the local app has actual evidence for the exact figure** | No dummy numbers |
| CareerLandscape sort drop-down | Implement deterministic meaningful sort (skill overlap, role title) or omit | No inert control or fictional ranking |
| LifeChapterDesigner starting-point templates | **Replace** with Career Landscape's single saved selected route | No prewritten progression sequence |
| Horizontal timeline + selected milestone details | **Port** with career, ESCO-skill, goal and break nodes | Sourced requirements vs user-created events explicitly separated |
| Predefined life-goal options | Keep as opt-in **categories** only | No automatically asserted life goals |
| Add/edit/delete life-goal modal + timeline navigation | **Port and extend** to skills and breaks | User-controlled order/timing, persistence and undo/confirm |
| Reference financial/risk/return calculators | **Omit** | User rejected what-if and unsourced projections |
| Reference nonpersistent React state | Replace with shared state + persistent server plan | One journey per profile, optimistic revisions |
| Reference pink/navy palette / Geist font | Use Pathwaay current page theme/fonts | No split design language |

### Defaults chosen unless the existing code or reference necessitates something else

- **Exactly one career journey per saved profile** (confirmed by owner). The user can edit/revise/reset the single journey; **no multiple journey list, archive, switching UI or multiple concurrently active plans**. Historical revisions are only for concurrency/safety if implemented, not user-selectable journeys.
- A valid path contains an explicit **starting occupation plus at least one selected destination occupation**. Starting occupation alone does not unlock Life Chapter Designer.
- Permit **up to three destination-role steps** after the start (four total role nodes) **by default**; one canonical bounded config (`MAX_DESTINATION_STEPS`, default `3`) must be enforced by the backend and reflected by the frontend. If changed, saved routes over the new cap need an explicit review warning; never silently truncate. This cap is an interface/performance limit, **not** a claim about career paths.
- Show **up to six evidence-grounded candidate branches** per graph expansion by default; users can search for a specific real ESCO occupation to explore additional options. These are not six hardcoded jobs. At the max path length, disable further add-step actions and show why; the user can edit/backtrack.
- **No automatic milestone dates** or benchmark timelines from the reference `careerTemplates`. Users choose dates/relative years/ordering and can leave dates unset; keep chronology stable for entries without dates.
- Skill goals are linked to the selected role's documented ESCO requirements; personal goals and breaks are chosen from user-opt-in categories or typed by the user. Generic reference goal choices are not fabricated user data unless preselected or auto-inserted; never auto-create them.
- Saved timeline edits are **autosaved with explicit Saving/Saved/Unsaved/Error status**, conflict protection and no silent data loss.
- Language: English. Adapt to actual reference interactions if available without violating evidence requirements.

---

## 1. Why the feature exists

**Pathwaay goal:** Help people understand possible career directions in an AI-changing workforce, compare their recognised skills with documented occupation requirements, and build an actionable personal learning journey.

**Feature promise:**

> **Explore potential career transitions using documented occupational skills, then design and save a personal development timeline around the chosen path.**

### Section A: Career Landscape — “Explore and choose where to go”

Shows the user's chosen starting occupation and clickable alternative occupations. Each selectable node uses real ESCO identity and source metadata. The lines between occupations are **application-computed skill-overlap suggestions**, **not** official ESCO career-transition relations or guarantees.

### Section B: Life Chapter Designer — “Plan how to prepare”

Unlocks when the user confirms at least one transition. Displays an editable horizontal timeline linked to the **one saved occupation path**. Users add source-backed skill-development milestones and personal goals/breaks. The user controls dates and priorities. It is **a planning tool**, not a predictive engine.

### User value

- See alternatives to one target role rather than accept a single ranked recommendation.
- Understand **which existing skills overlap**, **which requirements are not yet evidenced**, and why an option was shown.
- Use existing Pathwaay skill-gap data without pretending that a plan completion certifies occupational competence.
- Save/revisit plans; personalise for real commitments, goals and breaks.

---

## 2. Architecture / existing integration points

**Read the current local sources**; the remote `KW` branch may not include the user's latest uncommitted Career Details and Pathway work. Do not overwrite newer local code based on stale remote copies.

Verified/relevant repository locations from the checked `KW` baseline:

| Purpose | Inspect first |
|---|---|
| Main header navigation | `src/frontend/app/PathwaayRibbon.tsx` |
| Workspace layout/theme | `src/frontend/app/(workspace)/layout.tsx`, `src/frontend/app/(workspace)/globals.css`, `src/frontend/app/pathwaay-ribbon.css` |
| Other feature routes | `src/frontend/app/(workspace)/(future-ready)/role-matching/...` |
| Profile retrieval/handoff | `src/frontend/app/(workspace)/profile-workspace.ts`, `src/frontend/lib/pathwaay-profile.ts`, `src/api/profiles.py`, `src/services/profile_service.py` |
| ESCO index & provenance | `src/services/future_roles/occupation_index.py`, `data/index/esco_v1.2.1_en.json.gz`, manifest, `src/services/future_roles/data_repository.py` |
| Real occupation detail/search | `src/api/future_roles.py` (`/api/v2/roles/detail`, `/api/v2.1/roles/search`, etc.) |
| Profile relevance/gaps | `src/services/future_roles/profile_relevance.py`, `src/services/future_roles/role_search.py`, `src/services/future_roles/workspace_profile.py` |
| Existing pathway | `src/services/future_roles/personalized_reskilling.py`, `src/services/future_roles/resource_discovery.py`, `src/frontend/components/PathwayView.tsx` |
| SQLite | `src/services/storage.py` and existing repository/service patterns |
| API entry | `src/main.py`, `src/api/` |
| Frontend transport | `src/frontend/lib/future-role-api.ts`, `src/frontend/lib/api.ts` |
| Standards | `.agents/skills/3am-design-system/SKILL.md`, `.agents/skills/3am-data-integrity/SKILL.md`, `.agents/skills/3am-project-standards/SKILL.md` (note they may describe older architecture; current code is authoritative) |

### Important existing facts

- `OccupationIndex` stores `roles`, `skills`, `edges` (role → requirements), `reverse` (skill → occupations), `coverage`, `fingerprint` and per-source metadata.
- The normal index loader attempts full, version-pinned ESCO data and can fall back to a **limited local 15-role/demo subset**. **Do not quietly present demo fallback as full real coverage.** Surface a clear unavailable/limited-data state and never fabricate missing roles.
- `profile_relevance.py` computes application-defined relevance and missing essential skills. These are **not** hiring probability, eligibility, job-market demand or future job prediction.
- The profile workspace stores a profile reference in local browser storage and retrieves the saved profile via a backend route. Investigate whether the current app has **true authentication/ownership controls** before exposing saved plans. A profile ID alone must **not** be treated as secure authorisation.
- The user recently implemented substantial **uncommitted** Career Details and Pathway changes on `KW`. The local working tree must be the source of truth.

### Preferred architecture

```
Next.js /career-simulator
  ├── CareerSimulatorPage (workspace shell/header/theme)
  ├── CareerLandscape (graph, search, choose/edit route)
  │   └── OccupationCandidateCard / EvidenceDetails
  ├── LifeChapterDesigner (locked until path chosen)
  │   ├── HorizontalChapterTimeline
  │   ├── Goal / Skill Milestone / Break editors
  │   └── Save status + change-path reconciliation UI
  └── shared typed client state / API helpers
             │
           FastAPI
  ├── career simulator candidate/search/read models
  ├── deterministic ESCO-based relation explanation
  ├── saved plan create/read/update/delete
  └── evidence & input validation
             │
   ESCO index + saved profile + SQLite
```

Do **not** duplicate ESCO ingestion, profile-normalisation rules or resource-verification logic. Use service functions, not long frontend-only heuristics.

---

## 3. Grounding rules: NO dummy content

### 3.1 Evidence classification

All displayed items must be classified as one of:

1. **Official source record** — occupation name, description, required skill and requirement type from the pinned ESCO index; attach version and source references.
2. **Application-derived suggestion** — computed role-to-role skill overlap or user-versus-role gap, using documented inputs, calculation method and coverage limits. Label `Suggested via shared documented skills`.
3. **User-authored decision/entry** — path choice, goal title, chosen dates, break description and personal notes. Label `Your plan` as appropriate; never attribute it to ESCO.
4. **Verified provider resource** — a course, duration, cost, provider/URL and evidence **only if** the existing Pathway contract actually supports the claim. Unknown remains unknown; suggested related course must not be promoted to confirmed ESCO coverage.
5. **Unavailable** — if real evidence is missing, show the missing-data state, not a made-up substitute.

### 3.2 Hard prohibitions

- No hardcoded mock occupations, generic fake career cards, fictional pathways, invented source links, fabricated salaries, employment forecasts or arbitrary readiness scores in production screens.
- No `AI Engineer → AI Lead` arrow marketed as an ESCO-approved promotion unless an actual external career-transition source explicitly supports that claim. ESCO role classification and occupational skill relations are **not** career-transition records.
- Do not silently convert a profile's self-reported skills into assessed mastery or infer all requirements of previously selected occupations as newly mastered.
- No arbitrary selection of “AI skills” by substring matching a role title or pretending the AI Trend Signal proves future labour demand. Overlay AI-related trend content **only where current data/source contracts support that exact assertion**; otherwise omit it.
- No invented calendar milestones or dates, provider course durations or fake completion timelines.
- Do not send users' CVs or personal goal text to a third-party model for this deterministic feature.

### 3.3 Evidence presentation

For each career node, display source identity (ESCO release, official role URI/link when present), occupation title and concise description when available.

For each suggested connection, show at minimum:

- `from_role_id`, `to_role_id`, both validated in the full index;
- names of the common documented skills, with canonical IDs;
- required skill IDs on the destination not present in the user's recognised profile, clearly called **not evidenced**, not “user lacks”;
- method: `esco-essential-skill-overlap-v1` or equivalent; any displayed comparison metric must have a documented formula and denominator;
- provenance / original source IDs; label that this is an **exploratory suggestion**.

### 3.4 Synthetic fallback

Tests may use minimal, explicitly synthetic fixtures; **production UI must never display them as actual recommendations**. If the full index is missing/invalid, explain how to restore it and disable unsupported graph expansion. Do not silently switch to curated dummy career progressions.

---

## 4. Career Landscape — top section

### 4.1 Initial screen and starting occupation

1. Read the current saved profile using the existing workspace mechanism.
2. Determine whether the saved profile contains a reliably mapped **ESCO occupation ID**. If it only has unverified free-text `current_occupation`, **do not silently assert an ESCO identity**. Offer search and explicit confirmation: `Choose my starting occupation`.
3. Support entering through an existing Career Details or Role Matching page by optional, validated `role_id` route/query context. This should **preselect a destination suggestion**, not impersonate a user's current occupation.
4. If profile is absent, show a clear prompt to create/save one. Depending on existing app convention, permit exploration after explicit selection of a starting ESCO occupation, but mark personal gap calculation unavailable until profile exists. **Do not create a fictional profile.**
5. Once a start role is confirmed, render it as the anchored first node.

### 4.2 Candidate graph: deterministic, source-backed

**Important:** ESCO does not contain a verified “promotion graph.” Candidate branches represent **skill-overlap suggestions**, not common career movements.

Recommended candidate algorithm (backend):

- Input: current selected role ID (`from_role_id`), original saved user skill IDs, current selected route IDs, an optional search query.
- Validate source role, target roles and required skill relationships using official, version-compatible index provenance; reject incomplete or synthetic evidence.
- Prefer candidates sharing one or more **documented essential skill IDs** with the current role. The default formula may use intersection size and/or Jaccard similarity over documented essential skill sets; define and test the exact formula, deterministic tie order and treatment of incomplete requirements.
- For each candidate, separately compute missing essential requirements relative to the **original recognised user profile**, not an imaginary augmented profile from preceding nodes.
- Return a bounded, stable set of distinct candidates; exclude nodes already in the route to avoid cycles. Apply reasonable server-side limits.
- Avoid a false `transition success %` or `promotion probability` indicator. A skill overlap percentage, if shown, must be labelled by its true denominator and formula. A simpler `N shared essential skills` is preferable.
- Search should support other **real** ESCO occupations not among the top six. A user may explicitly choose a real occupation with zero/low overlap, but mark it `User-selected aspiration — insufficient documented overlap to recommend as a related transition` rather than fabricate support for the connection.
- No recommendation should assert seniority, promotion probability or labour demand unless a genuine reviewed source exists.
- Ensure the algorithm does not accidentally exclude valid real roles solely because they fall below the existing Role Matching 30% qualification threshold; Career Simulator is an exploratory tool and has its **own clearly documented** selection semantics.

Performance: index is large. Use backend index/reverse mappings, limit and paginate results; do not send the entire ESCO index to the browser. Avoid expensive O(all_roles × all_skills) recalculation on every graph click.

### 4.3 Clickable graph UI

Adapt the **now-inspected static** CareerLandscape *visual composition* into a **new functional interactive graph**. The reference does not actually implement branch selection, so Codex must write that state and behaviour. Preserve the design concept:

- Selected career nodes connected by a clear, visually highlighted path (maximum **start + 3 destinations** by default).
- Clickable alternative branches; an explicit click chooses the next node.
- Hover/focus and keyboard-accessible detail: occupation description, overlapping skills, missing documented essentials, ESCO citation, relation type. Do **not** borrow the reference’s dummy match percentages, similar-profile statistics or career confidence labels.
- `Change this step`, `Go back one step` and `Start over` controls (confirmation before destructive changes).
- Distinguish selected nodes from suggested candidates and user-chosen low-overlap nodes with text labels, not only color.
- Do not arbitrarily scroll users or lose current selections on background data changes.
- Loading/error/empty states, responsive horizontal scrolling or a mobile step-list fallback, reduced-motion support.
- Do not add a heavy graph dependency unless reference code needs it and there is a clearly documented benefit. A lightweight SVG/CSS-based graph is acceptable.

### 4.4 Path-completion/selection condition

A starting occupation plus **at least one explicit downstream selected occupation** is the default unlock condition. When valid, show `Use this career path` / `Continue to Life Chapter Designer` and unlock the lower section on the same page. A saved valid journey should unlock it immediately on subsequent visits.

### 4.5 Interoperability

Where sources support it, offer navigation to the **existing** Career Details and Personalised Reskilling Pathway for a selected role. Do not transplant their entire expensive model/provider workflows into every graph node. Use existing source-backed skill gap data and links where available.

---

## 5. Life Chapter Designer — lower section

### 5.1 Locked and unlocked states

**Locked:** A visible but inactive preview/placeholder at the bottom of the page, with a precise message: `Choose at least one career transition above to start building your life and learning timeline.` Do not show fake milestones. Do not persist an empty fabricated timeline.

**Unlocked:** Render the **now-inspected** reference-style horizontally scrollable timeline with circular career/life nodes, selected node details, previous/next controls, and add/edit/delete-confirmation modal. The reference does **not** implement drag-and-drop, so **do not promise reference drag/reorder**; provide explicit reordering controls only if coherent with timeline dates/ordering. Use actual selected ESCO path labels, not `careerTemplates`.

### 5.2 Milestone types

| Type | Who creates it | Evidence and behaviour |
|---|---|---|
| Career stage | Derived from user's chosen ESCO role path | Name/URI from ESCO, ordering user-selected; **not** assumed employment history |
| Skill-development milestone | User adds from selected role's documented skills/gaps | Preserve canonical ESCO ID, originating role ID, essential/optional status and source IDs; no mastery claim |
| Learning-resource milestone (optional) | User explicitly adds from existing Pathway results | Preserve verified provider URL, claims and original resource ID; don't invent hours/prices |
| Personal goal | User | User-written title/details/date, labelled `Your goal` |
| Career/life break | User | User-written title, optional start/end date and notes; no predicted employment effect |
| Free-form note | User (optional, only if reference supports it) | Never display as a verified career requirement |

Do **not** auto-insert unapproved goal dates or aspirational job titles. Offer contextual **suggestions** such as `Add documented missing skills` only upon a deliberate action. The user chooses what becomes part of the saved plan.

### 5.3 Timeline interactions

- Add, edit, remove milestones and chapters; preserve timeline ordering and provide accessible control for user-edited order/date. Respect that the reference sorts by target year and does not support drag-and-drop.
- Show `Add skill`, `Add goal`, `Add break` in a manner consistent with the reference source.
- Skill selector filters **documented requirements of the selected target roles** and retains precise source IDs.
- Optional personal notes are self-authored and clearly distinguished from sourced claims.
- Dates can be unset; if set use valid calendar dates or year-month range. Enforce only chronological coherence (e.g. end not before start). Do not impose unsupported completion forecasts.
- Distinguish **career / ESCO skill / personal goal / break** with accessible labels, adapting the reference’s career-vs-life node styling to a Pathwaay palette. Never use the reference’s preset career dates or completion-looking progress bar as proof of progress.
- Preserve stable milestone IDs across edits; avoid losing focus, unsaved changes or item order after rerender.
- Provide informative empty states if there are no skill gaps, no provider resources, or no user goals yet.
- Provide an `Edit chosen path` link back to the top section.

### 5.4 Editing the Career Landscape after creating timeline content

**Non-destructive behaviour is mandatory. The supplied reference does the opposite:** `changeStartingPoint()` clears life nodes. This is explicitly overridden by the owner’s requirement to save goals, skills and breaks; do **not** import the destructive handler.

- When selected role path changes, do **not** silently wipe goals, breaks or skill milestones.
- Recompute which sourced milestones still belong to the revised target roles.
- Preserve self-authored goals/breaks as-is.
- For milestones tied only to removed roles, place them into a clearly labelled `Needs review / no longer on active path` area. Let the user delete, retain as personal plans or reassign where evidence supports it.
- Show a confirmation message before replacing a route that affects sourced milestones.
- Do not auto-map an old skill ID onto a different career skill simply because the words resemble each other.
- Ensure this reconciliation survives save/reload and is not just client-side ephemeral state.

### 5.5 Persistence user experience

- Changes save without requiring user to manually reselect path or reconstruct timeline each session.
- Display status (`Saving…`, `Saved`, `Couldn't save — changes still on this page`, `Conflict — reload/resolve`).
- Do not falsely display `Saved` before the backend acknowledges the write.
- Debounce frequent edits; flush or explicitly warn before navigation; retry only harmless local save operations in a bounded manner, never invoke chargeable services.
- On initial page load, retrieve saved path and milestones; restore graph selection, unlocked state and timeline contents.
- Support explicit `Reset journey` or `Delete saved plan` with a confirmation and clear semantics. Do not delete the user's profile or other Pathwaay data.


### 5.6 Faithful interaction requirements mapped from the supplied Life Chapter file

The owner wants the **horizontal timeline and customisable goal/break interaction**, not its extra financial simulation. Implement these minimum interactions:

1. Render selected ESCO career path nodes in chronological **path-order**, initially without invented `Year 1/3/5` dates. On adding a user-time for a milestone, allow reordering by that time while keeping stable fallback order for undated entries.
2. Let the user move focus between timeline nodes via click and previous/next buttons; maintain a selected-detail panel below like `ChapterPlanCard`.
3. Keep a separate `Add Life Goal` modal using curated **choice labels only**, plus custom goal, target-year/optional date and optional duration. No preset life event should appear until selected.
4. Provide `Add Documented Skill` from actual uncovered ESCO essential/optional requirements associated with chosen destination(s), with skill label, role and source. This is a new integration absent from the prototype.
5. Provide `Add Break`, with user-entered title, optional start and duration/end. Breaks are **user intentions**, never medically inferred or assigned by AI.
6. Edit and delete **user-authored** timeline elements through the reference-style modal/confirmation; sourced ESCO career role nodes can be changed only through the top Career Landscape path editor.
7. The prototype's `lifeGoalOptions` categories can be used as selectable choices, but no required financial information, automatic scores, financial-readiness panels, return-to-work readiness labels, or invented career consequences.
8. The selected node's details may show: career → verified role description and source-backed matched/not-evidenced skills; skill → ESCO requirement and optional verified learning resource; goal/break → user's own title, notes, dates/duration and an edit control.
9. Mirror the reference's scrollable timeline, but ensure reduced motion, responsive compact cards, keyboard focus and no unexpected smooth-scroll jumps.
10. Store and restore the selected route, all timeline nodes, user-edited ordering/timing and associated details; do not store React components, computed presentation strings or invented progress percentages.

### 5.7 One saved journey and bounded path — exact UX contract

- One selected saved profile → **one** `CareerSimulatorPlan` record and **one** combined timeline. Do not implement a `My Journeys` collection or “Create another journey.”
- A fresh profile with no saved route shows an empty but functional Career Landscape. The Life Chapter Designer remains locked until the user confirms a start + destination.
- Default `MAX_DESTINATION_STEPS = 3`; **starting role does not consume a destination slot**. Valid number of destination roles is 1–3 once unlocked. Configure through a single server-owned setting and return the effective cap in the API response; UI must not rely on a disagreeing magic number.
- When the cap is reached, show `Maximum 3 career steps selected — edit an existing step to explore another route` (adapt the numeral to the actual returned cap) and stop offering an Add Step action; role search for replacing a step remains available.
- Every next step represents a **user-selectable potential move based on shared skill requirements** or an explicitly selected aspiration. It does **not** inherit credentials, automatically acquire missing skills or gain fake seniority.
- `Change path` / `Start over` requires confirmation and preserves self-authored timeline items unless the user explicitly resets the entire journey. Skill milestones whose source role has been removed become `needs_review` and remain accessible.
- Autosave and returning later update/restore the **same record**. A different saved profile has its own separately scoped one journey and cannot see the first profile's data.

---

## 6. Suggested contracts and storage (adapt to current code)

These are **proposed new interfaces**, not claims that they already exist. Codex should implement the smallest consistent endpoints following current Pydantic/router/storage conventions and document actual final paths.

### 6.1 Evidence-aware career candidate

```ts
type CareerCandidate = {
  role_id: string;                 // validated ESCO canonical URI/ID
  title: string;                   // from the pinned index
  description: string | null;      // sourced, never invented
  from_role_id: string;
  evidence_kind: "documented_skill_overlap" | "user_selected_aspiration";
  shared_essential_skill_ids: string[];
  shared_essential_skill_labels: string[];
  not_evidenced_essential_skill_ids: string[];  // vs original user's recognised skills
  source_ids: string[];
  source_urls: string[];           // only URLs validated from source registry
  dataset_version: string;
  relation_method: string;
  overlap_count: number;
  explanation: string;             // deterministic, no unsourced causal/predictive claims
};
```

### 6.2 Saved career plan

Example **schema placeholders** only; `role_id` values below are not example ESCO records and must **never** appear in a real user-facing response.

```json
{
  "schema_version": "1.0",
  "plan_id": "<opaque-plan-identifier>",
  "profile_id": "<existing-profile-identifier>",
  "revision": 1,
  "status": "active",
  "esco_version": "v1.2.1",
  "index_fingerprint": "<actual-installed-index-fingerprint>",
  "starting_role_id": "<real-ESCO-role-id>",
  "selected_role_ids": ["<real-ESCO-destination-role-id>"],
  "chapters": [],
  "milestones": [],
  "created_at": "<server-generated-timestamp>",
  "updated_at": "<server-generated-timestamp>"
}
```

Every timeline milestone should include:

- unique opaque milestone ID, type (`skill`, `goal`, `break`, possibly `learning_resource`), order and optional chapter ID;
- user-controlled title, description and dates where allowed;
- for sourced entries: `role_id`, `skill_id`, provider resource ID/source IDs as applicable;
- `origin`: `esco_requirement` / `verified_learning_resource` / `user_entry`;
- `review_status`: `active` / `needs_review`, when a selected path changes;
- provenance version/IDs **stored as stable references**, with source detail resolved and validated server-side;
- no copied private CV text unless explicitly required and appropriately protected.

### 6.3 Recommended service interface

- `POST /api/v2/career-simulator/candidates` — validate starting/current role and normalised profile, return bounded verified candidates with deterministic comparison evidence.
- `POST /api/v2/career-simulator/roles/search` — search real ESCO roles (or reuse an existing compatible search endpoint); never send the whole index.
- `GET /api/v2/career-simulator/plan` — load the current scoped plan using the application's real profile/session ownership mechanism.
- `PUT /api/v2/career-simulator/plan` — upsert the current plan with a revision/precondition check; validate IDs/provenance and bound payload size.
- `DELETE /api/v2/career-simulator/plan` — delete/reset only that plan after explicit confirmation.

**Do not invent an auth mechanism by naming endpoints above.** Inspect actual authentication first. If no secure identity/ownership is implemented, do not expose personal plans through an unauthenticated predictable `profile_id` URL. Options: (a) use actual existing user authentication, or (b) for a clearly labelled local **demo-only** implementation, use a high-entropy per-browser/per-plan capability token and server-side hash verification, with secure handling and documented browser-only recovery constraints. A bare profile ID or client-supplied arbitrary profile ID alone is not authorization. Do not claim multi-user security without an actual ownership mechanism. If secure persistence cannot be implemented under the project constraints, **report this as a blocker rather than ship an exposed endpoint**.

### 6.4 SQLite

Use the existing `src/services/storage.py` migration/init pattern or a coherent additive repository module. Suggested table fields:

```
career_simulator_plans:
  plan_id TEXT PRIMARY KEY
  profile_id TEXT NOT NULL
  revision INTEGER NOT NULL
  payload TEXT NOT NULL    -- validated JSON, not arbitrary executable content
  schema_version TEXT NOT NULL
  created_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  [owner/session protection columns if required by current auth design]
```

- **Enforce exactly one saved journey per profile under validated ownership**, e.g. unique indexed `profile_id` within the authenticated owner scope or unique (`owner_scope_id`, `profile_id`) when applicable. `PUT` updates that record rather than creating another. Enforce this transactionally, not just in React state.
- Validate before writes; use parameterised SQL and transaction + optimistic revision check to avoid lost updates between tabs. Enforce **destination steps ≤ configured cap**, no repeated ESCO role IDs, and every referenced role/skill ID present in the full pinned index.
- On stale revision return a safe conflict (e.g. HTTP `409`) and let the UI resolve/reload; never silently overwrite another tab's changes.
- Use backend-generated timestamps; do not trust client-supplied creation times.
- Do not rewrite existing profile or discovery-job tables, remove old data or commit local SQLite files.
- Store references and user-authored entries, **not copies of entire ESCO catalogs, external search page bodies or private CV data**.

### 6.5 Caching and source updates

- Sourced role data can be resolved dynamically by stable ESCO ID and the pinned index. Store `esco_version` and index fingerprint; if dataset version changes, show `Evidence changed — review plan` instead of quietly mutating saved interpretations.
- Cached candidate lists must key on starting role, version/fingerprint and relevant profile skill fingerprint; stale caches should not substitute unrelated profiles.
- Provider/course links remain external source references; never assert ongoing availability without check.

---

## 7. Frontend layout and navigation

### 7.1 Route and header

- New `src/frontend/app/(workspace)/career-simulator/page.tsx`, unless latest local code suggests a more appropriate workspace route group. Compose from imported lightweight components, **not** two nested full-page `<main>` wrappers from the reference TSX.
- In `src/frontend/app/PathwaayRibbon.tsx`, add `{ href: "/career-simulator", label: "Career Simulator" }` **last** in user `sections`, after Role Matching. Do not change `employerSections` unnecessarily.
- Ensure current navigation active-state logic works; preserve logout/navigation behaviours.
- Test narrower screens; current header has several items, so allow horizontal scroll, compact labels or existing responsive overflow rather than breaking layout.

### 7.2 Theme

- Reuse actual current Pathwaay styles. Verified user-facing frontend baseline uses dark green, evergreen accents and DM Sans/Space Grotesk within relevant route styles, though some older `.agents` docs mention a different palette/fonts. Inspect **actual current CSS and existing workspace pages**; current runtime styles win.
- Do not import the reference repository's entire global stylesheet, rose/navy theme, Geist font or Tailwind assumptions. Rebuild the reference composition in current Pathwaay styling. The reference files depend on packages absent from the checked frontend `package.json`; do not silently add dependencies.
- Port only necessary visuals and interactions from reference components, preserving meaningful composition: CareerLandscape’s trajectory/step cards and connector layout; LifeChapterDesigner’s horizontal node timeline, navigation, add/edit/delete modal and selected-detail card. **Omit source calculators, unsupported percentages, hardcoded template milestones and reference navigation links.**
- Accessible keyboard selection for graph nodes, SVG edges decorative unless interactable, visible focus, form labels and notices, reduced-motion, mobile screen reader-friendly list view.

### 7.3 Page composition

```
Pathwaay header/nav
  Career Simulator intro (title, brief explanation, data status)
  ┌─────────────────────────────────────────┐
  │ SECTION 1: CAREER LANDSCAPE             │
  │ start-role selector + source details    │
  │ clickable role graph + candidate cards  │
  │ selected route summary + save state     │
  └─────────────────────────────────────────┘
                  ↓ select a path
  ┌─────────────────────────────────────────┐
  │ SECTION 2: LIFE CHAPTER DESIGNER        │
  │ initially locked                       │
  │ horizontal timeline; chapters          │
  │ skill goals + personal goals + breaks   │
  │ edit/reorder + save confirmation        │
  └─────────────────────────────────────────┘
```

User should understand what comes from ESCO, what is calculated and what they personally chose, without technical noise. Prefer expandable `Why suggested?` / `Sources` for detailed attribution.

---

## 8. Detailed required flows

### Flow A — first visit with saved profile

1. Open `/career-simulator`; shared header shows Career Simulator last.
2. Show initial loading; fetch profile and check full ESCO coverage.
3. If current occupation maps to a verified ESCO ID, offer it for confirmation; otherwise search a real ESCO occupation.
4. Display starting node and evidence-based candidate branches (or a clear empty state).
5. User clicks a branch, optionally expands additional evidence-based branches, and accepts a valid path.
6. Life Chapter Designer unlocks and stays on page.
7. User adds at least one documented skill milestone and a user-authored goal/break; dates are optional.
8. Save and show server-acknowledged `Saved`; reload and verify identical selected roles, milestone content and order.

### Flow B — saved return visit

1. Fetch saved plan for the scoped profile.
2. Restore graph selected nodes, lower section unlocked, timeline ordering, goals, breaks and source references.
3. No Tavily, Runpod or generation jobs should be triggered by mere page load.
4. If data changed or a source is unavailable, preserve the saved user plan and show the relevant source limitation.

### Flow C — edit path after goals exist

1. Change selected destination/branch.
2. Show which ESCO-linked milestones need review, explain the effect, require confirmation.
3. Keep user goals and breaks; do not delete them.
4. Preserve or mark old linked milestones for review without passing them off as new-role requirements.
5. Save revision and verify after reload.

### Flow D — data gaps

- No saved profile: no fabricated user skills; show honest setup action.
- No exact current-occupation ESCO mapping: explicit user selection.
- Missing full ESCO index: clear unavailable/limited-data state; no demo replacement masquerading as sourced data.
- No shared-skill candidates: allow verified manual ESCO search; label zero-evidence transition as user-chosen aspiration.
- No skill gaps: tell user recognised concepts cover listed target essentials; don't create extra arbitrary skill goals.
- No verified course: skill milestone remains possible; learning resource suggestion unavailable with no fabricated URL.
- SQLite save failure/offline: retain UI draft and show unsaved warning; no false success.

### Flow E — concurrent tabs

1. Open same plan in two tabs.
2. Tab A saves revision N+1.
3. Tab B attempts to save stale revision N and receives conflict.
4. Tab B must not silently overwrite A; offer reload/merge review and preserve B's unsaved local editing buffer until resolved.

---

## 9. Testing, quality and acceptance criteria

Tests should use **mocked API responses and clearly marked synthetic fixtures only within test code**. Production and demo UI should use actual pinned ESCO records and actual saved user choices. No live external API calls without explicit approval.

### Backend service tests

- Occupation candidate output uses only released/verified ESCO roles and documented skill IDs.
- Correct overlapping essential skills; missing skills are measured against the user's original recognised profile.
- Deterministic ordering with tie-breaks and maximum candidates; zero-overlap explicitly searched aspiration is labelled, not recommended as evidence.
- Cycles and repeated roles cannot enter a selected path; backend enforces **1–3 destination roles by default**, with config-specified limit and no silent truncation. Exceed-limit returns a safe validation error and cap is returned to frontend.
- Source links/IDs/version are genuine and correctly mapped; synthetic/partial fallback never silently presented as full.
- Profile's free-text current occupation never silently converted to an ESCO ID without verified mapping/confirmation.
- Inputs reject fabricated occupation IDs, skill IDs, impossible dates, overlong text, payload/resource abuse and duplicate milestones.
- No trend-market-demand/AI claims without exact existing source support.

### Persistence / security tests

- Create, reload, update, delete; **exactly one** plan per proper owner/profile scope, including concurrent first-create contention, update-in-place, and no multi-plan switching.
- Revisions prevent concurrent lost updates; server timestamps and validated JSON work.
- Unrelated profiles/users or missing authorization cannot read/modify another plan.
- Manual reset does not affect profile, ESCO index or other services.
- Saved plan retains user notes/goals/breaks through graph edits.
- Dataset version change marks evidence for review but keeps user content.
- Database is never cleared by app initialization or test runs.

### Frontend component tests

- Career Simulator is the final navigation item and active state works.
- Two sections render in the correct order and match existing Pathwaay page style.
- Lower section locked for start-only/unselected route, unlocked after start + 1–3 destinations by default, max-step disabled with explanation, unlocked on saved revisit.
- Click/keyboard branch choice, selected-path highlighting, per-node source view, graph reset confirmation.
- Real/derived/user information clearly labelled; **no old CareerLandscape dummy stats or LifeChapterDesigner financial readiness, career-risk scores, return forecasts, hardcoded timelines, or false selection progress**.
- Add/edit/reorder/delete skill goal, personal goal and break; no default life events; previous/next node navigation and detail panel ported from reference.
- Empty states are truthful; skill IDs carried through to saved data.
- Path change preserves personal items and marks orphaned sourced milestones for review.
- Save state: idle/saving/saved/error/conflict; no duplicate autosave racing; stale API replies not overwrite a new profile/route.
- Responsive layout (mobile viewport), keyboard interaction, labels/focus and prefers-reduced-motion.
- Graph interaction does not automatically call Tavily or Runpod.

### End-to-end demonstration (real pinned records, no synthetic recommendations)

- Use an existing **real ESCO role from the installed full index** and a consented, already existing demo/testing profile; do not invent role IDs.
- Select a starting role and an evidenced destination; inspect shared skills and missing essential skill source provenance.
- Unlock Life Chapter Designer; add a sourced skill milestone + user-authored goal + break.
- Save; navigate away; reload; confirm restoration.
- Change the route; confirm preservation/review status; save and reload.
- Inspect API payload for provenance flags, no fabricated timestamps/prices/claims.
- If no real user/test profile is available, do not quietly generate one in production. Request the user's permission to use an explicitly labelled synthetic test profile in a test environment only.

### Mandatory verification commands

Adapt to actual local package/testing conventions. At minimum:

```bash
# From the right directories; inspect package scripts first.
cd src/frontend
npm run typecheck
npm run build
npm run test:components
npm run test:logic
# Return to repository root for relevant targeted Python tests.
python -m pytest -q tests/test_career_simulator.py
# Then the relevant existing backend regression tests.
```

If the test filenames differ, report actual commands. Do not modify unrelated failing checksum tests merely to make the suite green; distinguish pre-existing failures and provide reproducible evidence.

### Definition of done

- [ ] **Both attached reference TSX files actually inspected**; design/behaviour deviations documented, including static CareerLandscape, nonpersistent LifeChapterDesigner, and discarded calculators.
- [ ] Separate new route; header nav last; two stacked sections matching Pathwaay theme.
- [ ] Functional career graph using real ESCO roles, explainable skill-based suggestions and sources.
- [ ] No fictional role transitions, unsourced match/confidence numbers, similar-profile claims, default career year templates, readiness scores or financial calculations in real UI.
- [ ] Life Chapter Designer unlocks on route selection, shows horizontal editable timeline.
- [ ] Skill goals are source-backed; user goals/breaks user-authored; no invented dates.
- [ ] Persist/reload **exactly one** path and its chapters, goals, skills and breaks per profile reliably; do not create a multi-plan UI.
- [ ] Safe ownership/authorisation or explicitly scoped demo security design, not open arbitrary profile-ID access.
- [ ] Route changes preserve entries and flag content needing review.
- [ ] Loading, no-data, failure, conflict and mobile states work.
- [ ] Tests pass; no unrelated regressions; any pre-existing failures documented.
- [ ] No external paid model/provider calls; no secrets exposed; no commit or push.

---

## 10. Staged implementation plan for Codex

**Do not try to write the whole feature in one giant unreviewed patch. Implement in coherent phases, run targeted tests per phase, and keep a rolling change log.** The project owner requested a complete plan, but the implementation should remain incremental and testable.

### Phase 0 — Audit and feasibility gate

- Confirm working branch, `git status`, latest local edits and repo conventions.
- **Read both supplied TSX references in the Codex workspace** (ask for them only if not actually mounted/copyable there). Audit their dependencies and confirm which visual/interaction features are ported or deliberately excluded. No need to fetch their inaccessible GitHub repo if attachments are available.
- Inspect profile identity/security, actual installed full ESCO index, current navigation and rendering.
- Identify any existing reusable graph/timeline infrastructure.
- Produce `Career Simulator Technical Audit` with files, risks and chosen integration points.
- Do not discard local work. If source access/security is a blocker, explicitly state limitation; proceed on independent phases only where safe.

### Phase 1 — Evidence-backed backend

- Design Pydantic contracts and candidate engine; deterministic skill comparison and sources.
- Implement source-verified search/candidates with bounded response sizes.
- Add backend unit tests with fixtures and actual index compatibility tests without live provider calls.
- Reuse profile/role rules. Do not hardcode fictional career journeys.

### Phase 2 — Saved plan persistence

- Implement additive SQLite schema, scoped save/read/update/delete and optimistic locking.
- Implement profile/session ownership protection after auditing actual auth; document limitations.
- Add preservation/reconciliation logic and backend persistence/security tests.

### Phase 3 — Career Landscape visual port

- Create new route, append nav last, implement top graph and evidence drawers/cards.
- Port the **actual static reference’s trajectory/step-card composition**, adding real stateful clickable branching and deterministic ESCO-based candidate evidence. No hardcoded prototype tracks/metrics.
- Use actual API data, no production mock card filler.
- Test node selection, graph keyboard access, responsive behaviour and source labels.

### Phase 4 — Life Chapter Designer visual port

- Port the **actual reference’s** horizontal nodes, previous/next selection, modal add/edit/remove and selected chapter panel. Replace predefined career templates with the chosen ESCO roles and remove unrelated financial/readiness/return calculators.
- Wire unlock trigger, goal/skill/break editors, timeline ordering and safe path-edit reconciliation.
- Shared plan state with autosave + explicit status; restore on revisit.
- Test interactions and persistence.

### Phase 5 — Integration/regressions/documentation

- End-to-end check using actual ESCO index and an appropriately authorised test profile.
- Run full relevant backend/frontend regression suites and production build.
- Verify no new Runpod/Tavily calls, role matching and existing Pathway unaffected, header stable and navigation responsive.
- Document actual route, endpoint/contract names, data semantics, storage/authorization, source provenance, component ownership, how to demo and known limitations.
- **Stop. Do not stage, commit or push.**

### Phase reports

After each phase, record: files changed; behaviour finished; what is verified vs assumed; test results; open blockers; whether the next phase is safe. Never claim end-to-end completion based only on mocked tests.

---

## 11. Scope limits and non-goals

**In scope:** one Career Simulator page; source-backed occupation exploration; user-selected route; evidence-aware skill gaps; editable goals/skills/breaks timeline; persistent save/reload; UX/accessibility/tests.

**Out of scope:**

- what-if labour or life scenario calculators;
- employment probability, guaranteed role eligibility, salary or promotion forecast;
- LLM-generated hypothetical career routes or AI-authored user goals;
- Tavily live course discovery on every click;
- automated learning-course enrolment, employment applications or real hiring claims;
- employer-facing version unless explicitly requested;
- new authentication provider/deployment architecture, except minimal security protection necessary to avoid exposing stored plans;
- rewriting Career Details, AI Trend Signal, Career Demo, Role Matching or existing Pathway;
- paid APIs, surprise provider inference or unapproved live use;
- silent overwrites of existing local uncommitted work.

---

## 12. Suggested UX microcopy (not data)

The following labels are interface copy, not fabricated facts:

- Page title: **AI Career Transition Simulator**
- Subtitle: **Explore career possibilities using documented skills, then shape a learning and life timeline around your choices.**
- Top heading: **Career Landscape**
- Connection label: **Suggested from shared ESCO skills — not a verified career progression**
- Gap label: **Essential requirements not yet evidenced by your profile**
- Source button: **Why is this path suggested?**
- Path action: **Use this career path**
- Bottom heading: **Life Chapter Designer**
- Locked copy: **Choose at least one career transition above to unlock your timeline.**
- Skill action: **Add documented skill**
- Personal action: **Add personal goal**
- Break action: **Add break**
- Data warning: **Occupational data: ESCO. Suggested connections are calculated skill overlap, not hiring or promotion predictions.**
- Saving: **Saving…** → **Saved** only after API acknowledgment.

---

## 13. Handoff / sign-off report requested from Codex

Provide one final report with sections:

1. **Reference source audit:** confirm both uploaded TSX files inspected; specifically report which real interactions were ported, which examples/calculators removed, dependency decisions and visual deviations.
2. **Architecture:** actual services, components, API endpoints, state flow, diagram.
3. **Data provenance:** ESCO release/coverage, role skill overlap method, sample real cited records used for validation, explicit unsupported claims excluded.
4. **Section A: Career Landscape:** implemented node/branch/search/selection and empty states.
5. **Section B: Life Chapter Designer:** locking, timeline, skills/goals/breaks, path-change safety and restoration.
6. **Storage/security:** schemas, ownership model, autosave/revisions, privacy and residual risks.
7. **Tests:** exact test commands, counts, TypeScript/build and known failures (new vs pre-existing).
8. **Manual verification:** what was actually run in a browser, data source and outcomes; do not claim what wasn't checked.
9. **Files changed** and any new dependencies.
10. **Open issues** and smallest actions left for user to validate.
11. **Git status:** verify branch `KW`, preserve all existing uncommitted work, nothing staged/committed/pushed.

---

## 14. Immediate Codex instruction

> You are the implementation agent for the **AI Career Transition Simulator**. Read the entire `CAREER_SIMULATOR_CODEX_HANDOFF.md` document before editing anything. First audit the **current local KW working tree** and the two original reference TSX files (`CareerLandscape.tsx` and `LifeChapterDesigner.tsx`) plus their imports. Implement a new `/career-simulator` page with the Career Landscape on top and Life Chapter Designer underneath, using real pinned ESCO occupations and source-backed skill requirements. Career links are transparent deterministic suggestions based on documented skills, not verified career progressions. Unlock the user-editable horizontal life/learning timeline only after they choose a path. Save and restore path, goals, skills and breaks with safe persistence and non-destructive editing. Match current Pathwaay theme, append Career Simulator last in the user navigation, and add comprehensive tests. **Exactly one saved journey per profile; maximum three destination occupations by default (server-configurable); no hardcoded paths, no what-if feature, no fictional production data, no live Tavily/Runpod calls, no unrelated code rewrites and no commits/pushes.** Implement in phases, report actual test evidence and respect the verified reference-source audit and any genuine persistence/authorization blockers described in this document.
