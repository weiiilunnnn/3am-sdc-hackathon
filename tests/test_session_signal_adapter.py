"""Integration-specific safety and empty-evidence tests."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from src.services.session_signal_adapter import SessionSignalProfile, get_session_connections


class SessionSignalAdapterTests(unittest.TestCase):
    def test_rejects_private_fields(self):
        with self.assertRaises(Exception):
            SessionSignalProfile.model_validate({
                "occupation": "Analyst", "skills": [{"name": "Data analysis"}],
                "email": "not-allowed@example.test",
            })

    def test_unknown_skill_kept_without_false_match(self):
        profile = SessionSignalProfile(skills=[{"name": "Unrecognized domain-specific skill"}])
        source = SimpleNamespace(source={"name": "Himalayas"}, posting_count=0,
                                 last_successful_refresh=None, refresh_status="never")
        with (patch("src.services.session_signal_adapter.get_saved_skill_connections", return_value=(None, [])),
              patch("src.services.session_signal_adapter.get_signal_employment_dashboard", return_value=source)):
            response = get_session_connections(profile)
        self.assertEqual(response["connections"], [])
        self.assertEqual(response["coverage"], "no_direct_evidence")
        self.assertTrue(response["skills"][0]["key"].startswith("custom:"))

    def test_non_profile_skill_selection_rejected(self):
        profile = SessionSignalProfile(skills=[{"name": "Data analysis"}])
        with self.assertRaises(ValueError):
            get_session_connections(profile, "local:unrelated-skill")

    def test_session_fields_are_not_echoed_or_persisted(self):
        profile = SessionSignalProfile(occupation="Analyst", aspiration="Learning ML",
                                       skills=[{"name": "Python programming"}])
        source = SimpleNamespace(source={"name": "Himalayas"}, posting_count=5,
                                 last_successful_refresh=None, refresh_status="success")
        with (patch("src.services.session_signal_adapter.get_saved_skill_connections", return_value=(None, [])),
              patch("src.services.session_signal_adapter.get_signal_employment_dashboard", return_value=source)):
            response = get_session_connections(profile)
        self.assertNotIn("aspiration", str(response))
        self.assertEqual(response["source_state"]["posting_sample_size"], 5)


if __name__ == "__main__":
    unittest.main()
