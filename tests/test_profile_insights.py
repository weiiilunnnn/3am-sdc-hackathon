"""Rule-based profile indicators and supportive suggestions."""

import unittest
from copy import deepcopy

from src.data.sample_profiles import get_sample_profiles
from src.models.profiles import ProfileInput, ProfileRecord
from src.services.profile_insights import build_profile_insights
from src.services.profile_service import normalize_skills


def _record(values: dict) -> ProfileRecord:
    values = deepcopy(values)
    values.pop("sample_id", None)
    values.pop("label", None)
    profile = ProfileInput.model_validate(values)
    return ProfileRecord.model_validate({
        **profile.model_dump(mode="json"),
        "skills": [skill.model_dump(mode="json") for skill in normalize_skills(profile.skills)],
        "id": "profile",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    })


class ProfileInsightTests(unittest.TestCase):
    def test_indicators_have_transparent_denominators_and_no_employability_score(self):
        profile = _record(get_sample_profiles()[0])
        result = build_profile_insights(profile)
        self.assertEqual(result.indicators[0].numerator, 4)
        self.assertEqual(result.indicators[0].denominator, 8)
        self.assertIsNone(result.indicators[2].value_percent)
        self.assertTrue(all("employability" in indicator.limitation.lower() or "self-reported" in indicator.limitation.lower() or "non-empty" in indicator.limitation.lower() or "pdf" in indicator.limitation.lower() for indicator in result.indicators))
        self.assertTrue(result.suggestions)

    def test_experience_description_check_uses_saved_records_only(self):
        values = deepcopy(get_sample_profiles()[0])
        values["experience"] = [
            {"id": "role-1", "title": "Support associate", "description": "Helped resolve requests."},
            {"id": "role-2", "title": "Event assistant", "description": ""},
        ]
        result = build_profile_insights(_record(values))
        experience = next(item for item in result.indicators if item.id == "experience-descriptions")
        self.assertEqual((experience.numerator, experience.denominator, experience.value_percent), (1, 2, 50.0))


if __name__ == "__main__":
    unittest.main()
