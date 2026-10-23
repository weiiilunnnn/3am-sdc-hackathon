import unittest
from unittest.mock import patch

from scripts import dev


class DevelopmentLauncherTests(unittest.TestCase):
    def test_windows_frontend_command_uses_npm_cmd_through_shell(self):
        with patch("scripts.dev.shutil.which", return_value=r"C:\Program Files\nodejs\npm.cmd") as which:
            command, uses_shell = dev._frontend_command("3002", windows=True)

        which.assert_called_once_with("npm.cmd")
        self.assertTrue(uses_shell)
        self.assertIn("npm.cmd", command)
        self.assertIn("--prefix src/frontend run dev -- --port 3002", command)

    def test_posix_frontend_command_runs_npm_directly(self):
        with patch("scripts.dev.shutil.which", return_value="/usr/bin/npm") as which:
            command, uses_shell = dev._frontend_command("3002", windows=False)

        which.assert_called_once_with("npm")
        self.assertFalse(uses_shell)
        self.assertEqual(command, ["/usr/bin/npm", "--prefix", "src/frontend", "run", "dev", "--", "--port", "3002"])

    def test_missing_npm_reports_which_executable_is_required(self):
        with patch("scripts.dev.shutil.which", return_value=None):
            with self.assertRaisesRegex(FileNotFoundError, "npm.cmd"):
                dev._frontend_command("3002", windows=True)

    def test_process_groups_use_platform_specific_options(self):
        self.assertEqual(dev._process_options(windows=False), {"start_new_session": True})
        self.assertEqual(
            dev._process_options(windows=True),
            {"creationflags": dev.subprocess.CREATE_NEW_PROCESS_GROUP},
        )


if __name__ == "__main__":
    unittest.main()
