"""Run both development services; stop both if either service exits."""

import os
import argparse
from pathlib import Path
import signal
import shutil
import socket
import subprocess
import sys
import time
import threading

ROOT = Path(__file__).resolve().parents[1]


def stop_process(process: subprocess.Popen) -> None:
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    else:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        if os.name == "nt":
            process.kill()
        else:
            os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def check_port(port: int) -> None:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", port))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", "-p", type=int, default=int(os.getenv("PORT", "3000")))
    parser.add_argument("--hostname", "-H", default="0.0.0.0")
    args = parser.parse_args()
    api_port = int(os.getenv("API_PORT", "8080"))
    web_port = args.port
    try:
        if api_port == web_port:
            raise ValueError("API_PORT and the frontend port must be different")
        check_port(api_port)
        check_port(web_port)
    except (OSError, ValueError) as error:
        print(f"Cannot start development servers: {error}. Stop existing servers or change API_PORT/PORT.", file=sys.stderr)
        return 1
    env = {**os.environ, "BACKEND_URL": f"http://127.0.0.1:{api_port}"}
    node = os.getenv("NODE_EXECUTABLE") or shutil.which("node") or "node"
    commands = [
        [sys.executable, "-m", "uvicorn", "src.main:app", "--host", "127.0.0.1", "--port", str(api_port), "--reload"],
        [node, str(ROOT / "src/frontend/node_modules/next/dist/bin/next"), "dev", "--webpack",
         "--hostname", args.hostname, "--port", str(web_port)],
    ]
    processes: list[subprocess.Popen] = []
    shutdown = threading.Event()

    def stop(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, stop)
    print(f"Starting frontend on port {web_port}; FastAPI/proxy on port {api_port}.", flush=True)
    try:
        for index, command in enumerate(commands):
            options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {"start_new_session": True}
            child_env = env if index == 0 else {k: v for k, v in env.items() if k not in {"RUNPOD_API_KEY", "TAVILY_API_KEY"}}
            processes.append(subprocess.Popen(command, cwd=ROOT if index == 0 else ROOT / "src/frontend", env=child_env,
                                              stdin=subprocess.DEVNULL, **options))
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
