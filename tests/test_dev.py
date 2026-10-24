import os
import unittest
from unittest.mock import patch

from scripts import dev


class DevelopmentLauncherTests(unittest.TestCase):
    def test_frontend_command_runs_next_directly_without_reentering_launcher(self):
        with patch.dict(os.environ, {"NODE_EXECUTABLE": r"C:\Program Files\nodejs\node.exe"}, clear=True):
            command = dev._frontend_command("3002", "127.0.0.1")

        self.assertEqual(command[0], r"C:\Program Files\nodejs\node.exe")
        self.assertEqual(command[1], str(dev.ROOT / "src/frontend/node_modules/next/dist/bin/next"))
        self.assertEqual(command[2:], ["dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3002"])

    def test_frontend_command_finds_node_when_launcher_did_not_supply_it(self):
        with patch.dict(os.environ, {}, clear=True), patch("scripts.dev.shutil.which", return_value="node"):
            command = dev._frontend_command("3002")

        self.assertEqual(command[0], "node")

    def test_process_groups_use_platform_specific_options(self):
        self.assertEqual(dev._process_options(windows=False), {"start_new_session": True})
        # Emulate the Windows-only constant when this test runs on macOS/Linux.
        # The production code remains unchanged and receives the real constant on Windows.
        with patch.object(dev.subprocess, "CREATE_NEW_PROCESS_GROUP", 0x200, create=True):
            self.assertEqual(
                dev._process_options(windows=True),
                {"creationflags": 0x200},
            )


if __name__ == "__main__":
    unittest.main()
