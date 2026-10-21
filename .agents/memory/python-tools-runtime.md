---
name: Python packages on Replit
description: Replit's basic Python runtime and package-capable Python Tools module differ.
---

The `python-base-*` Replit module provides an interpreter but no pip; package installs fail in its immutable environment. Use a Python Tools module such as `python-3.12` when the project needs pip-installed packages.

**Why:** The FastAPI setup could not install dependencies under `python-base-3.13`; switching to `python-3.12` supplied pip and resolved installation without bypassing environment protections.

**How to apply:** Check the configured Python module before installing `requirements.txt`; prefer a package-capable Python Tools module rather than attempting `pip --break-system-packages`.
