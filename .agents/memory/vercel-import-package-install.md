---
name: Vercel import package install
description: Recovery context for a workspace install blocked by a transitive dependency.
---

When the imported workspace's install was blocked by the package firewall on transitive `proxy-addr@2.0.7`, updating the API server's direct Express dependency to its latest version allowed `pnpm install` to complete.

**Why:** The initial lockfile could not be fully installed, so code generation and app checks failed until the direct dependency was updated.

**How to apply:** If this workspace's package install encounters the same transitive firewall rejection, try updating the direct parent package and rerun `pnpm install`; do not bypass the firewall.
