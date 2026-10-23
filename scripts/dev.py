"""Run both development services; stop both if either service exits."""

import argparse
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]


def _frontend_command(web_port: str, hostname: str = "0.0.0.0") -> list[str]:
    node = os.getenv("NODE_EXECUTABLE") or shutil.which("node") or "node"
    next_cli = ROOT / "src/frontend/node_modules/next/dist/bin/next"
    return [node, str(next_cli), "dev", "--webpack", "--hostname", hostname, "--port", web_port]


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


stop_process = _stop_process


def check_port(port: int) -> None:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", port))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", "-p", type=int, default=int(os.getenv("PORT", "3000")))
    parser.add_argument("--hostname", "-H", default="0.0.0.0")
    args = parser.parse_args()
    try:
        api_port = int(os.getenv("API_PORT", "8080"))
        if not 1 <= api_port <= 65535 or not 1 <= args.port <= 65535:
            raise ValueError("Ports must be between 1 and 65535")
    except ValueError as error:
        print(f"Cannot start development servers: {error}", file=sys.stderr)
        return 2
    web_port = args.port
    try:
        if api_port == web_port:
            raise ValueError("API_PORT and the frontend port must be different")
        check_port(api_port)
        check_port(web_port)
    except (OSError, ValueError) as error:
        print(f"Cannot start development servers: {error}. Stop existing servers or change API_PORT/PORT.", file=sys.stderr)
        return 1
    env = {**os.environ, "BACKEND_URL": f"http://127.0.0.1:{api_port}", "PORT": str(web_port)}
    commands = [
        ("FastAPI", [sys.executable, "-m", "uvicorn", "src.main:app", "--host", "127.0.0.1", "--port", str(api_port), "--reload"]),
        ("Next.js", _frontend_command(str(web_port), args.hostname)),
    ]
    processes: list[subprocess.Popen] = []
    shutdown = threading.Event()

    def stop(_signum, _frame):
        raise KeyboardInterrupt

    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, stop)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, stop)
    print(f"Starting frontend on port {web_port}; FastAPI/proxy on port {api_port}.", flush=True)
    try:
        options = _process_options()
        for index, (name, command) in enumerate(commands):
            child_env = env if index == 0 else {k: v for k, v in env.items() if k not in {"RUNPOD_API_KEY", "TAVILY_API_KEY"}}
            cwd = ROOT if index == 0 else ROOT / "src/frontend"
            try:
                processes.append(subprocess.Popen(
                    command,
                    cwd=cwd,
                    env=child_env,
                    stdin=subprocess.DEVNULL,
                    **options,
                ))
            except OSError as exc:
                print(f"Could not start {name}: {exc}", file=sys.stderr)
                return 1
        if os.getenv("DEV_LAUNCHER_PIPE") == "1":
            def watch_launcher():
                # EOF also stops children if the Node launcher disappears.
                sys.stdin.readline()
                shutdown.set()
            threading.Thread(target=watch_launcher, daemon=True).start()
        while not shutdown.is_set() and all(process.poll() is None for process in processes):
            time.sleep(0.2)
        if shutdown.is_set():
            return 0
        return next(process.returncode for process in processes if process.returncode is not None)
    except KeyboardInterrupt:
        return 0
    except OSError as error:
        print(f"Cannot start development servers: {error}", file=sys.stderr)
        return 1
    finally:
        for process in processes:
            stop_process(process)


if __name__ == "__main__":
    raise SystemExit(main())
