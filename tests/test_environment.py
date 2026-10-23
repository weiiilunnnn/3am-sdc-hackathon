"""Mock-only local credential loading; never read the user's existing .env."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from src import environment


class BackendEnvironmentTests(unittest.TestCase):
    def setUp(self):
        cache = Path(__file__).resolve().parents[1] / ".cache"
        cache.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix="env-test-", dir=cache)
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / ".env"

    def load(self, text, existing=None):
        self.path.write_text(text, encoding="utf-8")
        with patch.object(environment, "ROOT_ENV_PATH", self.path), patch.dict(os.environ, existing or {}, clear=True):
            environment.load_backend_environment()
            return dict(os.environ)

    def test_defaults_to_absolute_repository_root(self):
        self.assertEqual(environment.ROOT_ENV_PATH, Path(__file__).resolve().parents[1] / ".env")
        self.assertTrue(environment.ROOT_ENV_PATH.is_absolute())

    def test_mock_credentials_load_independent_of_working_directory(self):
        previous = Path.cwd()
        try:
            os.chdir(self.temp.name)
            result = self.load('RUNPOD_API_KEY="mock-runpod"\nTAVILY_API_KEY=mock-tavily\n')
        finally:
            os.chdir(previous)
        self.assertEqual(result["RUNPOD_API_KEY"], "mock-runpod")
        self.assertEqual(result["TAVILY_API_KEY"], "mock-tavily")

    def test_system_values_take_precedence_and_repeated_loading_is_safe(self):
        result = self.load('RUNPOD_API_KEY=file-mock\nTAVILY_API_KEY=file-mock\nRUNPOD_LLM_ENDPOINT_ID=file-endpoint\n',
            {"RUNPOD_API_KEY": "system-mock", "RUNPOD_LLM_ENDPOINT_ID": "system-endpoint"})
        self.assertEqual(result["RUNPOD_API_KEY"], "system-mock")
        self.assertEqual(result["RUNPOD_LLM_ENDPOINT_ID"], "system-endpoint")
        self.assertEqual(result["TAVILY_API_KEY"], "file-mock")

    def test_blank_values_do_not_disable_shared_endpoint_default(self):
        result = self.load('RUNPOD_API_KEY=\nTAVILY_API_KEY=\nRUNPOD_LLM_ENDPOINT_ID=" "\n')
        self.assertEqual(result, {})

    def test_missing_file_is_safe(self):
        with patch.object(environment, "ROOT_ENV_PATH", self.path), patch.dict(os.environ, {}, clear=True):
            environment.load_backend_environment()
            self.assertNotIn("TAVILY_API_KEY", os.environ)

    def test_fastapi_bootstrap_loads_before_clients_in_fresh_process(self):
        self.path.write_text('RUNPOD_API_KEY=mock-runpod\nTAVILY_API_KEY=mock-tavily\nRUNPOD_LLM_ENDPOINT_ID=\n', encoding="utf-8")
        env = {k: v for k, v in os.environ.items() if k not in {"RUNPOD_API_KEY", "TAVILY_API_KEY", "RUNPOD_LLM_ENDPOINT_ID"}}
        env["PYTHONPATH"] = str(Path(__file__).resolve().parents[1])
        code = """
import os, sys
from src import environment
environment.ROOT_ENV_PATH = __import__('pathlib').Path(sys.argv[1])
import src.main
from src.services import sdg_text
assert os.environ['RUNPOD_API_KEY'] == 'mock-runpod'
assert os.environ['TAVILY_API_KEY'] == 'mock-tavily'
assert os.getenv('RUNPOD_LLM_ENDPOINT_ID', sdg_text.LLM_ENDPOINT_ID) == sdg_text.LLM_ENDPOINT_ID
assert 'src.services.sources.runpod_api' in sys.modules
assert 'src.services.sources.tavily_api' in sys.modules
"""
        result = subprocess.run([sys.executable, "-c", code, str(self.path)], cwd=self.temp.name,
                                env=env, capture_output=True, text=True, timeout=25)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "")


if __name__ == "__main__": unittest.main()
