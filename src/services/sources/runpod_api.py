"""Small RunPod Serverless HTTP client shared by the Pathwaay demo services."""

from __future__ import annotations

import json
import os
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class RunPodRequestError(RuntimeError):
    """Raised when RunPod is unavailable or returns an invalid response."""
    def __init__(self, message: str, *, category: str = "provider_error", http_status: int | None = None,
                 elapsed_seconds: float | None = None, timeout_seconds: float | None = None):
        super().__init__(message)
        self.category = category
        self.http_status = http_status
        self.elapsed_seconds = elapsed_seconds
        self.timeout_seconds = timeout_seconds


class RunPodConfigurationError(RunPodRequestError):
    """Required provider configuration is missing."""

def run_sync(endpoint_id: str, payload: dict[str, Any], *, timeout: float = 60) -> dict[str, Any]:
    return _request(endpoint_id, "runsync", payload, timeout=timeout)


def health(endpoint_id: str, *, timeout: float = 5) -> dict[str, Any]:
    """Read worker/job counts without submitting an inference job. No retries."""
    return _request(endpoint_id, "health", None, timeout=timeout)


def _request(endpoint_id: str, operation: str, payload: dict[str, Any] | None, *, timeout: float) -> dict[str, Any]:
    api_key = os.getenv("RUNPOD_API_KEY")
    if not api_key or api_key == "your-runpod-api-key":
        raise RunPodConfigurationError("RunPod is not configured. Set RUNPOD_API_KEY in the backend environment.")
    if not endpoint_id:
        raise RunPodConfigurationError("RunPod is not configured. Set RUNPOD_LLM_ENDPOINT_ID in the backend environment.")

    request = Request(
        f"https://api.runpod.ai/v2/{endpoint_id}/{operation}",
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST" if payload is not None else "GET",
    )
    started = time.monotonic()
    def failure(category, status=None):
        return RunPodRequestError("RunPod request failed.", category=category, http_status=status,
                                  elapsed_seconds=round(time.monotonic()-started, 3), timeout_seconds=timeout)
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
        category = "authentication" if exc.code in {401, 403} else "rate_limit" if exc.code == 429 else "http_server" if exc.code >= 500 else "http_client"
        error = failure(category, exc.code)
        error.args = (message,)
        raise error from exc
    except TimeoutError as exc:
        raise failure("timeout") from exc
    except URLError as exc:
        raise failure("timeout" if isinstance(exc.reason, TimeoutError) else "transport") from exc
    except json.JSONDecodeError as exc:
        raise failure("transport_json") from exc
    if not isinstance(result, dict):
        raise RunPodRequestError("RunPod returned an invalid response.")
    return result


def unwrap_llm_output(result: dict[str, Any]) -> dict[str, Any]:
    """Normalize the common public endpoint output wrappers."""
    if result.get("status") in {"IN_QUEUE", "IN_PROGRESS"}:
        raise RunPodRequestError("RunPod job is not ready.", category="queued")
    if result.get("error") or result.get("status") in {"FAILED", "CANCELLED", "TIMED_OUT"}:
        raise RunPodRequestError("RunPod job did not complete.", category="job_failed")
    output = result.get("output")
    if isinstance(output, list) and output and isinstance(output[0], dict):
        output = output[0].get("result", output[0])
    elif isinstance(output, dict) and isinstance(output.get("result"), dict):
        output = output["result"]
    if not isinstance(output, dict):
        raise RunPodRequestError("RunPod returned no language model output.")
    return output
