# Replit development

The application uses Next.js in `src/frontend/` and FastAPI in `src/main.py`.

Install `requirements.txt` and run `npm --prefix src/frontend ci` before using the Run button. `.replit` runs `python scripts/dev.py`, which starts both services. The frontend exposes port 3000 and proxies `/api/*` to the private backend on 8080.

Use npm, not pnpm. There are no workspace artifacts or Drizzle migrations. Profiles use SQLite and fictional data only. See README.md and docs/architecture.md for routes, local commands and deployment limitations.
