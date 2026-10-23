# Feature 4 — Personalised Reskilling Pathway: Targeted UI Refinement

**For:** Codex in the existing 3am-sdc-hackathon Next.js + FastAPI repository  
**Reference:** `docs/Feature4_Pathway_Visual_Reference.png`  
**Scope:** Presentation changes **only** on the existing Personalised Reskilling Pathway page. Implement directly; avoid a planning phase.

## 1. Authoritative design goal

Keep the current **dark-green pathway summary card exactly as it is**, and keep the current **vertical timeline with ordered learning phases and certification section**. The objective is a *modest polish*, **not** another dashboard redesign: add a few relevant icons, visually connect timeline steps, improve the breathing room within course/credential cards, and eliminate unsupported metadata labels. Follow the reference image's general spacing, simple outlines, cream/green palette and connected left timeline, **not its sample course metadata or wording**.

**The reference is a static illustration, not a data source.** It may display illustrative Beginner/Intermediate/Video badges, prices, times, providers, courses, durations or phase counts. Never copy these as hardcoded values. Render only values provided by the application's existing verified resource records / backend response. Do not use the image to override the actual number or names of phases, resources, gaps, courses or credentials.

## 2. Preserve untouched functionality

- **Do not change** the current dark-green summary/hero card: contents, score/figures, notices, layout and logic remain unchanged, even if the summary currently says “Time unavailable”.
- Preserve Career Details / Role Matching back-navigation and the selected occupation and profile.
- Keep the existing deterministic pathway planner: ESCO requirements, recognised/unevidenced skills, resource eligibility, prerequisite order, budget, learning phases, estimated schedules, uncovered-gap reporting and certifications.
- Keep existing Runpod GLM-5.3 and Tavily discovery, evidence verification, cached/local resources, metadata origin, provider/source links, and `.env` credential handling **unchanged**.
- Preserve local-catalogue fallback warnings and **Remaining Learning Gaps**. Do not hide genuine pathway incompleteness or unavailable discovery notices; these are status messages, not optional course metadata.
- Do not change Feature 3 matching scores, discovery, search, analysis or the Career Details page. No new APIs, services, data, dependencies or live provider calls are needed.

## 3. Timeline visual polish: connect ordered steps

- Reuse the current numbered timeline (`01`, `02`, `03`, etc.) and existing ordering; do **not** hardcode a three-step dataset. Actual phases and certification opportunities must come from the API.
- Draw one slim, **visually continuous vertical connector** through the centre of each numbered step marker. It should stay aligned from the first displayed step through the last, with the markers visually above the line. A CSS pseudo-element or a simple absolute connector within the existing timeline container is sufficient.
- Keep the current section layout, expand/collapse controls and titles. Add a restrained, consistent heading icon for the type of phase where appropriate (e.g. book/seedling for foundations, monitor/book-open for online learning, award for certifications). These **phase icons are static semantic category mappings**, not random icons or AI output.
- Avoid changing the phase naming/numbering logic; preserve the existing representation if an unusual phase is returned.
- Responsive: the line must remain properly connected and markers aligned on mobile without horizontal scrolling.

## 4. Resource-card layout: more internal space, not larger empty blocks

Keep the **existing simple stacked resource-card list** inside timeline sections, instead of switching to an entirely different multi-column catalogue UI.

- Desktop: use approximately **20–24px card padding** (or equivalent existing spacing scale); mobile: approximately **16–20px**. Modestly increase vertical gaps between provider line, linked title, available metadata and expandable evidence.
- Allow natural card height, title wrapping and chip wrapping. Use `min-width: 0`, responsive flex/grid, `overflow-wrap` and appropriate line height. Do **not** truncate long titles or concept names; never overlap badges with text.
- Place one small (approximately 40–48px), softly tinted, consistent icon tile near the course/credential identity, with title and provider aligned beside it. Avoid large decorative illustrations, thumbnails and unsupported logos.
- If already rendered, preserve verified source-origin labels (Reviewed Catalogue / Discovered Online / Previously Discovered), verification dates, official URLs and **Details & Evidence** expanders. Style evidence as subtle secondary actions.
- Use restrained section icons, time/price/evidence icons and modest borders, not large background fills, gradients or prominent shadows. Maintain current green/neutral palette.

## 5. Critical dynamic display rule: evidence or omit

This is the highest-priority change. **Every optional per-resource or per-certification field is shown only when the backend provides a real, supported, trustworthy value. Otherwise do not render that field at all.** Do not replace missing values with “Not available”, “Unavailable”, “Unknown”, “Not found”, “N/A”, a dash, `0`, an empty badge or a guessed value. When omitted, the layout should close the space naturally.

| Field | Render only if… | Otherwise |
| --- | --- | --- |
| Resource title / provider URL | Existing resource has an authenticated/verified identity and valid source URL as required by current backend rules | Preserve existing verified-data fallback / error handling; never invent a resource |
| Provider name | Returned from verified resource record | Omit secondary provider label |
| Resource format (video, online course, article, documentation, exercise) | Actually supported by the record or retrieved provider evidence | Do not show a format label; use a neutral generic **icon only** |
| Difficulty (Beginner / Intermediate / Advanced) | **Explicitly provider-stated and source-backed**; not merely assumed from title, category, existing generic tag or LLM estimate | Omit difficulty label entirely |
| Duration / study time | Present as a valid duration with provenance | Omit duration metadata; never present zero or invented study time |
| Cost / Free Content / Paid | Verified source supports the exact claim under the existing pricing/cost metadata conventions | Omit the price/cost badge; do not assume free |
| Prerequisites | Verified provider record states them | Omit prerequisite line |
| Verified date / origin | Actual valid backend metadata exists | Omit the respective badge/line |
| Credential type, assessment format, exam fee and certificate fee | Each corresponding field has verified supporting data | Omit that individual field, never merge fees or invent eligibility |

**Scope detail:** Apply this omission rule to course/credential metadata and any similar optional metadata in phase descriptions. The unchanged dark-green hero and legitimate status notices are explicitly excluded. It is fine for a phase to state *supported target gaps / number of resources* because those are calculated facts; if duration is absent, **omit duration from that phase subtitle** instead of adding “Time unavailable”.

- Preserve important factual distinctions such as *provider-published duration* versus *application estimate*. Display the latter only if existing data explicitly says it is an estimate; never rebrand an estimate as provider-provided.
- Do not infer “video course” from “online course”, “beginner” from a short course, “free” from a working link, or a course's difficulty from model output.
- Preserve the existing evidence/source validation logic; do not move trust decisions from backend to frontend.
- This is a **rendering rule**, not an instruction to delete required audit fields from the API or backend.

### Dynamic icon selection

Use **static mappings** from trusted resource/credential type values into existing icons (e.g. Lucide already in the project). The icon itself changes **deterministically with the resource type**, never randomly and never through arbitrary LLM-generated icon names:

- online course → graduation cap / book
- confirmed video → play-circle
- documentation/article → book-open / file-text
- exercise/coding → code
- certification/assessment → award / badge-check
- type missing/unrecognised → neutral book icon **without a type label**

The correct type must originate from existing supported backend data. The icon is a UI representation, not evidence that a course has a particular format.

## 6. Certifications & Skill Assessments

- Preserve as the final timeline section, currently `03` when earlier steps are `01` and `02`. Do not artificially add an unavailable certification or another stage.
- Give certification cards the same slightly roomier padding, restrained award icon and natural text wrapping as learning resources.
- Keep real credential name, official source links, source/checked badges and **Official Sources & Evidence** expandable content.
- Present assessment, prerequisites, **exam fee** and **certificate fee** separately, **only** when their values are actually supported. Do not display empty rows or fallback words when any is missing.
- Keep the present honest empty state for zero qualifying certifications; do not invent credentials.

## 7. Remove only the bottom methodology section

Remove the bottom **“Pathway Method, Scheduling & Limitations”** expandable UI section and any now-unused rendering imports/styles. Do not remove underlying planner methods, data validation, timing methodology, or other necessary warning/status notices. Preserve official source links and evidence expanders elsewhere in the pathway and certification UI. Do not introduce a replacement bottom explanation card.

## 8. Accessibility and responsive constraints

- Phase accordions and evidence controls stay operable by mouse and keyboard, with focus states and accessible names.
- Decorative icons use `aria-hidden`; do not make icon alone the only meaningful label.
- Long course names, credential names and verified metadata wrap; no clipping/ellipsis/horizontal scrolling on common widths.
- Make timeline connector and its step circles line up consistently while phase content expands/collapses.
- Maintain readable size/contrast; avoid excessive microscopic metadata text.

## 9. Surgical implementation and checks (token efficiency is mandatory)

1. Locate the **current** Feature 4 pathway page, its resource/credential render components and **only** the relevant scoped CSS. Candidate: the existing `PathwayView` component. Inspect just those files and minimal frontend tests first; source tree may have changed since the handoff.
2. Reuse existing resource and certification data types and current icons/dependencies; prefer local conditional JSX and a small fixed icon mapping.
3. Implement the timeline connector, internal padding/gaps, evidence-based optional metadata rendering, and removal of the bottom methodology UI. No backend changes unless frontend data type inspection exposes an already-existing field that only needs to be passed through; if not available, omit it.
4. Run focused frontend/TypeScript checks. Verify visually or with scoped tests:
   - summary card remains unchanged;
   - 01→02→03 timeline visually connects and collapse works;
   - roomier one-per-row resource cards, correct dynamic type icons and natural wrapping;
   - **no Beginner / Intermediate / Video / Free / Duration / Fee claims without supported metadata**;
   - absent fields produce **no** “Unavailable”/“Not found”/“N/A” placeholders or empty rows;
   - known sourced fields still render correctly, including distinction between exam fee and certificate fee;
   - local/discovered/cached resource origin indicators and links remain correct;
   - Remaining Learning Gaps, fallback notices, and honest completion warnings remain;
   - no bottom Pathway Method, Scheduling & Limitations section;
   - links, back-navigation, phase source expanders, and certifications still work;
   - desktop and mobile widths.
5. **Do not call Runpod, Tavily or external APIs**, run the full test suite, reinstall dependencies, perform broad repository exploration, change data files or rewrite unrelated components. Use existing mock/test fixtures, with missing and present optional fields.
6. Keep tool outputs short. At the end report only: files changed, UI elements modified, focused checks passed/failed and any unverified visual issues. No new planning document.

## 10. Done criteria

A modestly polished **existing** Personalised Reskilling Pathway page: **dark-green summary untouched**, a visibly connected numbered timeline, slightly roomier cards with small type-aware icons, dynamic provider-backed details when present, truly **blank/omitted optional fields otherwise**, real evidence links preserved, and the bottom methodology expander removed. The backend reskilling decisions and API credentials remain unchanged.
