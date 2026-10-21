# Development definition of done

Use this checklist for application changes in the 3AM Aiversecity repository.

## Scope and implementation

- [ ] The change matches the requested task and does not implement unrelated competition features.
- [ ] Existing Next.js + FastAPI + SQLite architecture is preserved unless a change was explicitly approved.
- [ ] Application source remains inside `src/`; repository-level docs, tests, and configuration remain in their appropriate root directories.
- [ ] Existing behavior and imports were inspected before editing; changes are modular and avoid unnecessary dependencies.
- [ ] API contracts and errors are explicit and validated.

## Data, safety, and user experience

- [ ] Profiles remain fictional-only; no real personal information is requested or persisted.
- [ ] Every real source has documented provenance, terms, coverage, measurement, and limitations.
- [ ] Research activity is not described as labor-market demand; synthetic/estimated data is clearly distinguished.
- [ ] Loading, empty, and error behavior is handled for affected flows.
- [ ] Changed UI is checked for labels, keyboard operation, focus, contrast, chart descriptions, and mobile layout.

## Verification and delivery

- [ ] Relevant Python tests, frontend logic tests, frontend typecheck, and build were run as applicable.
- [ ] API/database and external-source tests use isolated storage and mocked data where appropriate.
- [ ] Existing affected journeys were checked; skipped browser or production checks are explicitly stated.
- [ ] Documentation and source-of-truth references were updated where behavior or procedures changed.
- [ ] Generated output, local databases, virtual environments, and secrets are not included in Git changes.
- [ ] Final report lists files changed, behavior delivered, commands/results, skipped verification, limitations, and remaining work.

Deployment, migrations, paid services, RunPod, destructive data actions, and commits require explicit user authorization when they are not already part of the request.
