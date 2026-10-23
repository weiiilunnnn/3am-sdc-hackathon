"""Run both development services; stop both if either service exits."""

import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def _frontend_command(web_port: str, *, windows: bool | None = None) -> tuple[str | list[str], bool]:
    is_windows = os.name == "nt" if windows is None else windows
    npm_name = "npm.cmd" if is_windows else "npm"
    npm = shutil.which(npm_name)
    if npm is None:
        raise FileNotFoundError(f"Could not find {npm_name}. Install Node.js and ensure npm is on PATH.")
    command = [npm, "--prefix", "src/frontend", "run", "dev", "--", "--port", web_port]
    if is_windows:
        return subprocess.list2cmdline(command), True
    return command, False


def _process_options(*, windows: bool | None = None) -> dict[str, int | bool]:
    is_windows = os.name == "nt" if windows is None else windows
    if is_windows:
        return {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    return {"start_new_session": True}


def _stop_process(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    try:
        if os.name == "nt":
            process.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            os.killpg(process.pid, signal.SIGTERM)
    except (OSError, ProcessLookupError):
        process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def main() -> int:
    api_port = os.getenv("API_PORT", "8080")
    web_port = os.getenv("PORT", "3000")
    for name, value in (("API_PORT", api_port), ("PORT", web_port)):
        if not value.isdecimal() or not 1 <= int(value) <= 65535:
            print(f"{name} must be a port number between 1 and 65535.", file=sys.stderr)
            return 2
    env = {
        **os.environ,
        "BACKEND_URL": f"http://127.0.0.1:{api_port}",
        "PORT": web_port,
    }
    try:
        frontend_command, frontend_uses_shell = _frontend_command(web_port)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    commands = [
        ("FastAPI", [sys.executable, "-m", "uvicorn", "src.main:app", "--host", "127.0.0.1", "--port", api_port, "--reload"], False),
        ("Next.js", frontend_command, frontend_uses_shell),
    ]
    processes: list[subprocess.Popen] = []

    def stop(_signum, _frame):
        raise KeyboardInterrupt

    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, stop)
    try:
        options = _process_options()
        for name, command, uses_shell in commands:
            try:
                process = subprocess.Popen(
                    command,
                    cwd=ROOT,
                    env=env,
                    shell=uses_shell,
                    **options,
                )
            except OSError as exc:
                print(f"Could not start {name}: {exc}", file=sys.stderr)
                return 1
            processes.append(process)
        while all(process.poll() is None for process in processes):
            time.sleep(0.2)
        return next(process.returncode for process in processes if process.returncode is not None)
    except KeyboardInterrupt:
        return 0
    finally:
        for process in processes:
            _stop_process(process)


if __name__ == "__main__":
    raise SystemExit(main())
