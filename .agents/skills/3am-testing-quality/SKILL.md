---
name: 3am-testing-quality
description: Guides test selection, verification, and completion reporting for changes to the 3AM Aiversecity project. Use after implementation or when investigating test gaps.
---

# 3AM Testing and Quality

Use this skill when adding behavior, fixing a defect, or reporting project readiness. Read [testing procedures](../../../docs/testing.md) for the exact commands and current test gaps.

## Test the changed behavior at the right level

- Backend logic: Python `unittest`, including valid, invalid, empty, and failure cases.
- API/database behavior: use isolated temporary SQLite paths and test request/response validation, persistence, and status codes.
- External providers: use fixture or mocked HTTP responses in automated tests. Do not make live API calls part of ordinary unit tests.
- Frontend logic: run the Node built-in test suite and the frontend TypeScript check.
- Browser journeys: verify profile sample → edit → save/reload and radar data/provenance states when browser automation is available. If it is not available, state the limitation and provide a manual checklist.
- Run the Next.js production build after relevant frontend changes; it generates `.next` output.

The root `pnpm run typecheck` does not include `src/frontend`; run `pnpm --filter 3am-sdc-frontend run typecheck` explicitly.

## Report accurately

Only report checks that were actually executed. Distinguish unit tests, API checks, visual inspection, browser E2E, and production build. State skipped checks, known limitations, data-source status, and remaining work. Use the [definition of done](../../../docs/definition-of-done.md) and do not claim a feature is complete based only on its UI or backend in isolation.
