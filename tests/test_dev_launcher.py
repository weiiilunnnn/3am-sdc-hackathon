"""Development startup must align proxy ports and clean up child services."""
import os
import signal
import subprocess
import unittest
from unittest.mock import Mock, patch

from scripts import dev


class DevLauncherTests(unittest.TestCase):
    def test_matching_ports_are_rejected_before_spawning(self):
        with patch.dict(os.environ, {"API_PORT": "8080"}), patch("sys.argv", ["dev.py", "--port", "8080"]), patch.object(dev.subprocess, "Popen") as spawn:
            self.assertEqual(dev.main(), 1)
            spawn.assert_not_called()

    def test_occupied_port_is_rejected_before_spawning(self):
        with patch("sys.argv", ["dev.py"]), patch.object(dev, "check_port", side_effect=OSError("busy")), patch.object(dev.subprocess, "Popen") as spawn:
            self.assertEqual(dev.main(), 1)
            spawn.assert_not_called()

    def test_proxy_matches_backend_and_frontend_has_correct_directory(self):
        api, web = Mock(returncode=2), Mock(returncode=None)
        api.poll.return_value = 2
        with patch.dict(os.environ, {"API_PORT": "8123", "BACKEND_URL": "http://wrong:8000", "RUNPOD_API_KEY": "mock-only", "TAVILY_API_KEY": "mock-only"}), patch("sys.argv", ["dev.py", "--port", "3123"]), patch.object(dev, "check_port"), patch.object(dev.subprocess, "Popen", side_effect=[api, web]) as spawn, patch.object(dev, "stop_process") as stop:
            self.assertEqual(dev.main(), 2)
            self.assertEqual(spawn.call_args_list[0].args[0][-2:], ["8123", "--reload"])
            self.assertEqual(spawn.call_args_list[1].kwargs["cwd"], dev.ROOT / "src/frontend")
            self.assertEqual(spawn.call_args_list[1].kwargs["env"]["BACKEND_URL"], "http://127.0.0.1:8123")
            self.assertEqual(spawn.call_args_list[1].args[0][-1], "3123")
            self.assertIn("--webpack", spawn.call_args_list[1].args[0])
            self.assertEqual(spawn.call_args_list[0].kwargs["env"]["TAVILY_API_KEY"], "mock-only")
            self.assertNotIn("TAVILY_API_KEY", spawn.call_args_list[1].kwargs["env"])
            self.assertNotIn("RUNPOD_API_KEY", spawn.call_args_list[1].kwargs["env"])
            self.assertEqual(stop.call_count, 2)

    def test_failed_second_launch_stops_first_service(self):
        api = Mock()
        with patch("sys.argv", ["dev.py"]), patch.object(dev, "check_port"), patch.object(dev.subprocess, "Popen", side_effect=[api, OSError("missing node")]), patch.object(dev, "stop_process") as stop:
            self.assertEqual(dev.main(), 1)
            stop.assert_called_once_with(api)

    def test_windows_cleanup_uses_process_tree(self):
        process = Mock(pid=123)
        with patch.object(dev.os, "name", "nt"), patch.object(dev.subprocess, "run") as run:
            dev.stop_process(process)
            self.assertEqual(run.call_args.args[0], ["taskkill", "/PID", "123", "/T", "/F"])
            process.wait.assert_called_once_with(timeout=5)


if __name__ == "__main__":
    unittest.main()
