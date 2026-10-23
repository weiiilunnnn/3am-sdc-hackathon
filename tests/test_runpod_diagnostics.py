import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from src.services.sources import runpod_api as api


class RunpodDiagnosticsTests(unittest.TestCase):
    def test_health_reuses_transport_without_submitting_inference(self):
        from unittest.mock import MagicMock
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"workers":{"ready":0},"jobs":{"inQueue":2}}'
        with patch.dict("os.environ", {"RUNPOD_API_KEY":"mock-only"}), patch.object(api,"urlopen",return_value=response) as call:
            result = api.health("mock-endpoint",timeout=3)
        request = call.call_args.args[0]
        self.assertEqual(request.full_url,"https://api.runpod.ai/v2/mock-endpoint/health")
        self.assertEqual(request.get_method(),"GET")
        self.assertIsNone(request.data)
        self.assertEqual(call.call_count,1)
        self.assertEqual(result["workers"]["ready"],0)
        with patch.dict("os.environ", {"RUNPOD_API_KEY":"mock-only"}), patch.object(api,"urlopen",side_effect=HTTPError("https://example.org",401,"private",{},None)):
            with self.assertRaises(api.RunPodRequestError) as caught:
                api.health("mock-endpoint")
        self.assertEqual(caught.exception.category,"authentication")

    def test_safe_error_categories_keep_original_cause(self):
        failures = [(TimeoutError("private detail"), "timeout", None),
                    (URLError(TimeoutError()), "timeout", None),
                    (URLError("private detail"), "transport", None),
                    (HTTPError("https://example.org", 401, "private detail", {}, None), "authentication", 401),
                    (HTTPError("https://example.org", 429, "private detail", {}, None), "rate_limit", 429),
                    (HTTPError("https://example.org", 503, "private detail", {}, None), "http_server", 503),
                    (json.JSONDecodeError("private detail", "x", 0), "transport_json", None)]
        for error, category, status in failures:
            with self.subTest(category=category), patch.dict("os.environ", {"RUNPOD_API_KEY":"mock-only"}), patch.object(api, "urlopen", side_effect=error):
                with self.assertRaises(api.RunPodRequestError) as caught:
                    api.run_sync("mock-endpoint", {"input":{}}, timeout=5)
                self.assertEqual(caught.exception.category, category)
                self.assertEqual(caught.exception.http_status, status)
                self.assertEqual(caught.exception.timeout_seconds, 5)
                self.assertIs(caught.exception.__cause__, error)
                self.assertNotIn("private detail", str(caught.exception))

    def test_queue_failure_and_output_wrappers_are_distinct(self):
        for status, category in [("IN_QUEUE","queued"),("FAILED","job_failed")]:
            with self.assertRaises(api.RunPodRequestError) as caught:
                api.unwrap_llm_output({"status":status})
            self.assertEqual(caught.exception.category, category)
        self.assertEqual(api.unwrap_llm_output({"output":[{"result":{"choices":[]}}]}), {"choices":[]})

    def test_model_truncation_and_json_failures_are_not_transport_errors(self):
        from src.services.future_roles.pathway_llm import invoke, LLMResponseError
        for choice, category in [({"finish_reason":"length","message":{"content":"{"}}, "model_truncated"),
                                 ({"message":{"content":"not JSON"}}, "model_json")]:
            with patch.object(api,"run_sync",return_value={"output":{"choices":[choice]}}):
                with self.assertRaises(LLMResponseError) as caught:
                    invoke({},"test",timeout=1,max_tokens=10)
            self.assertEqual(caught.exception.category,category)

    def test_safe_course_urls_and_domain_scoped_search(self):
        from src.services.sources import tavily_api
        from src.services.future_roles.resource_verification import provider_url, PROVIDERS
        url="https://developers.google.com/machine-learning/crash-course/logistic-regression?utm_source=test"
        self.assertEqual(provider_url(url),url.split('?')[0])
        for invalid in ["http://developers.google.com/course","https://127.0.0.1/course","https://169.254.169.254/latest", "https://localhost/course", "https://learn.microsoft.com.evil.example/course", "https://learn.microsoft.com:8443/course", "https://user:pass@learn.microsoft.com/course", "https://learn.microsoft.com/search"]:
            with self.subTest(url=invalid), self.assertRaises(ValueError):provider_url(invalid)
        with patch.object(tavily_api,"_post",return_value={"results":[]}) as post:
            tavily_api.search("course",timeout=3,include_domains=PROVIDERS)
        self.assertEqual(post.call_args.args[1]["include_domains"],list(PROVIDERS))

    def test_captured_broad_search_rejections_remain_rejected(self):
        from pathlib import Path
        from src.services.future_roles.resource_verification import provider_url
        replay=json.loads((Path(__file__).parent/"fixtures/tavily_rejected_replay.json").read_text())
        self.assertEqual(len(replay["candidates"]),4)
        for candidate in replay["candidates"]:
            with self.subTest(host=candidate["url"]), self.assertRaisesRegex(ValueError,"outside reviewed discovery scope"):
                provider_url(candidate["url"])
