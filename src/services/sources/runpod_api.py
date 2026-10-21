"""Small RunPod Serverless HTTP client shared by the Pathwaay demo services."""

from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from typing import Any


class RunPodRequestError(RuntimeError):
    """Raised when RunPod is unavailable or returns an invalid response."""


def run_sync(endpoint_id: str, payload: dict[str, Any], *, timeout: int = 60) -> dict[str, Any]:
    api_key = os.getenv("RUNPOD_API_KEY")
    if not api_key or api_key == "your-runpod-api-key":
        raise RunPodRequestError("RunPod is not configured. Set RUNPOD_API_KEY in the backend environment.")

    request = Request(
        f"https://api.runpod.ai/v2/{endpoint_id}/runsync",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RunPodRequestError("RunPod request failed.") from exc
    if not isinstance(result, dict):
        raise RunPodRequestError("RunPod returned an invalid response.")
    return result


def unwrap_llm_output(result: dict[str, Any]) -> dict[str, Any]:
    """Normalize the common public endpoint output wrappers."""
    output = result.get("output")
    if isinstance(output, list) and output and isinstance(output[0], dict):
        output = output[0].get("result", output[0])
    elif isinstance(output, dict) and isinstance(output.get("result"), dict):
        output = output["result"]
    if not isinstance(output, dict):
        raise RunPodRequestError("RunPod returned no language model output.")
    return output
