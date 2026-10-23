"""Small RunPod Serverless HTTP client shared by the Pathwaay demo services."""

from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class RunPodRequestError(RuntimeError):
    """Raised when RunPod is unavailable or returns an invalid response."""


class RunPodConfigurationError(RunPodRequestError):
    """Raised when the required RunPod credentials are not configured."""


def run_sync(endpoint_id: str, payload: dict[str, Any], *, timeout: int = 60) -> dict[str, Any]:
    api_key = os.getenv("RUNPOD_API_KEY")
    if not api_key or api_key == "your-runpod-api-key":
        raise RunPodConfigurationError("RunPod is not configured. Set RUNPOD_API_KEY in the backend environment.")
    if not endpoint_id:
        raise RunPodConfigurationError("RunPod is not configured. Set RUNPOD_LLM_ENDPOINT_ID in the backend environment.")

    request = Request(
        f"https://api.runpod.ai/v2/{endpoint_id}/runsync",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + api_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 401:
            message = "RunPod rejected the API key (HTTP 401). Check RUNPOD_API_KEY."
        elif exc.code == 403:
            message = "RunPod denied the request (HTTP 403). Check API key permissions."
        elif exc.code == 404:
            message = f"RunPod endpoint {endpoint_id} was not found (HTTP 404). Check RUNPOD_LLM_ENDPOINT_ID."
        elif exc.code == 429:
            message = "RunPod rate limited the request (HTTP 429). Try again later."
        else:
            message = f"RunPod request failed with HTTP {exc.code}."
        raise RunPodRequestError(message) from exc
    except (URLError, TimeoutError) as exc:
        raise RunPodRequestError("Could not connect to RunPod or the request timed out.") from exc
    except json.JSONDecodeError as exc:
        raise RunPodRequestError("RunPod returned a response that was not valid JSON.") from exc
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
