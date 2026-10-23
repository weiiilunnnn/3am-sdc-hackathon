"""RunPod HTTP helper tests that never contact the live service."""

import json
import unittest
from urllib.error import HTTPError
from unittest.mock import MagicMock, patch

from src.services.sources.runpod_api import (
    RunPodConfigurationError,
    RunPodRequestError,
    run_sync,
)


class RunPodApiTests(unittest.TestCase):
    def test_run_sync_sends_bearer_auth_and_decodes_json(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"output":{"ok":true}}'

        with patch.dict("os.environ", {"RUNPOD_API_KEY": "test-key"}), patch(
            "src.services.sources.runpod_api.urlopen",
            return_value=response,
        ) as urlopen:
            result = run_sync("test-endpoint", {"input": {"prompt": "synthetic"}})

        request = urlopen.call_args.args[0]
        request_headers = {key.lower(): value for key, value in request.header_items()}
        self.assertEqual(request_headers["authorization"], "Bearer test-key")
        self.assertEqual(json.loads(request.data), {"input": {"prompt": "synthetic"}})
        self.assertEqual(result, {"output": {"ok": True}})

    def test_run_sync_requires_credentials(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaises(RunPodConfigurationError):
                run_sync("test-endpoint", {"input": {}})

    def test_run_sync_reports_upstream_http_status_without_response_body(self):
        cases = (
            (401, "rejected the API key"),
            (403, "denied the request"),
            (404, "endpoint test-endpoint was not found"),
            (429, "rate limited the request"),
            (500, "failed with HTTP 500"),
        )
        for status_code, expected_message in cases:
            with self.subTest(status_code=status_code):
                error = HTTPError(
                    "https://api.runpod.ai/v2/test-endpoint/runsync",
                    status_code,
                    "Provider error body must not be exposed",
                    {},
                    None,
                )
                with patch.dict("os.environ", {"RUNPOD_API_KEY": "test-key"}), patch(
                    "src.services.sources.runpod_api.urlopen",
                    side_effect=error,
                ):
                    with self.assertRaisesRegex(RunPodRequestError, expected_message) as raised:
                        run_sync("test-endpoint", {"input": {}})

                self.assertNotIn("test-key", str(raised.exception))
                self.assertNotIn("Provider error body", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
