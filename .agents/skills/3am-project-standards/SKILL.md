---
name: 3am-project-standards
description: Guides architecture and implementation changes in the 3AM Aiversecity hackathon repository. Use before modifying application structure, APIs, or business logic.
---

# 3AM Project Standards

Use this skill for implementation or architecture work in this repository.

## Preserve the project boundaries

- Keep Next.js, React, and TypeScript in `src/frontend/`; keep FastAPI and all application source under `src/`. The API entry point is `src/main.py`.
- Preserve the existing frontend/backend separation. Put API routers in `src/api/`, Pydantic contracts in `src/models/`, application logic in `src/services/`, external providers in `src/services/sources/`, and structured data in `src/data/`.
- Do not move source into root-level app directories or rebuild the repository around the unused starter scaffold.
- This is the Aiversecity Domain 1 project, separate from Talent Bank and CareerOS.
- The six competition capabilities are intake, trend signals, explainable role matching, reskilling, SDG mapping, and uncertainty scenarios. Implement only the capability the user requests; do not mark future capabilities complete prematurely.
- Preserve SQLite prototype storage and the existing OpenAlex adapter unless the user explicitly approves a change. RunPod is reserved for possible future use; do not configure it without approval.

## Engineering conventions

- Inspect the affected implementation and its tests before editing. Prefer the smallest modular change that meets the request.
- Use strict TypeScript, Python type annotations where useful, Pydantic request/response schemas, and explicit API error handling.
- Keep provider I/O separate from business logic and UI code. Avoid duplicate data rules, silent fallbacks, unnecessary abstractions, and new dependencies without a demonstrated need.
- Keep generated files, local databases, virtual environments, and secrets out of Git.
- Update documentation when behavior, API contracts, data meaning, or development procedures change.

## References

- Follow [architecture and code organisation](../../../docs/architecture.md).
- Use the [definition of done](../../../docs/definition-of-done.md) before reporting completion.
- For relevant checks, follow [testing procedures](../../../docs/testing.md).
