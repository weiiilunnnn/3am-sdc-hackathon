"""Load local configuration only in the backend process, before router imports."""
import os
from pathlib import Path
from dotenv import dotenv_values

ROOT_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


def load_backend_environment() -> None:
    # Explicit path: independent of cwd. No interpolation of secrets into other
    # settings, no logs, and no replacement of existing system values.
    for name, value in dotenv_values(ROOT_ENV_PATH, encoding="utf-8", interpolate=False).items():
        if value is not None and value.strip():
            os.environ.setdefault(name, value)
