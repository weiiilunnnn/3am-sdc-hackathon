"""Run both development services; stop both if either service exits."""

import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    api_port = os.getenv("API_PORT", "8080")
    web_port = os.getenv("PORT", "3000")
    env = {**os.environ, "BACKEND_URL": f"http://127.0.0.1:{api_port}"}
    commands = [
        [sys.executable, "-m", "uvicorn", "src.main:app", "--host", "127.0.0.1", "--port", api_port, "--reload"],
        ["npm", "--prefix", "src/frontend", "run", "dev", "--", "--port", web_port],
    ]
    processes: list[subprocess.Popen] = []

    def stop(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop)
    try:
        for command in commands:
            processes.append(subprocess.Popen(command, cwd=ROOT, env=env, start_new_session=True))
        while all(process.poll() is None for process in processes):
            time.sleep(0.2)
        return next(process.returncode for process in processes if process.returncode is not None)
    except KeyboardInterrupt:
        return 0
    finally:
        for process in processes:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
