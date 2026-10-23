import os
import tempfile
import unittest
from copy import deepcopy

from pydantic import ValidationError

from src.data.sample_profiles import get_sample_profiles
from src.models.profiles import ProfileInput, SkillInput
from src.services.profile_service import (
    UnknownSkillIdError,
    create_profile,
    get_profile,
    list_sample_profiles,
    normalize_skills,
    update_profile,
)
from src.services.storage import initialize_database


def profile_input(sample: dict) -> ProfileInput:
    values = deepcopy(sample)
    for key in ("sample_id", "label", "taxonomy"):
        values.pop(key, None)
    return ProfileInput.model_validate(values)


class ProfileTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.previous_db_path = os.environ.get("APP_DB_PATH")
        os.environ["APP_DB_PATH"] = os.path.join(self.temp_dir.name, "profiles.sqlite3")
        initialize_database()

    def tearDown(self) -> None:
        if self.previous_db_path is None:
            os.environ.pop("APP_DB_PATH", None)
        else:
            os.environ["APP_DB_PATH"] = self.previous_db_path
        self.temp_dir.cleanup()

    def test_five_fictional_samples_are_available(self) -> None:
        samples = list_sample_profiles()
        self.assertGreaterEqual(len(samples), 5)
        self.assertTrue(all(sample["synthetic_demo"] is True for sample in samples))
        self.assertTrue(all(sample["skills"] for sample in samples))

    def test_required_fields_and_nonnegative_numeric_values_are_validated(self) -> None:
        sample = deepcopy(get_sample_profiles()[0])
        sample["years_experience"] = -1
        with self.assertRaises(ValidationError):
            profile_input(sample)

        sample = deepcopy(get_sample_profiles()[0])
        sample["learning_preferences"]["weekly_hours"] = -1
        with self.assertRaises(ValidationError):
            profile_input(sample)

        sample = deepcopy(get_sample_profiles()[0])
        sample["synthetic_demo"] = False
        self.assertFalse(profile_input(sample).synthetic_demo)

    def test_alias_resolves_and_unknown_skill_remains_custom(self) -> None:
        result = normalize_skills(
            [
                SkillInput(name="consult databases", proficiency="beginner"),
                SkillInput(name="Unlisted marine robotics", proficiency="intermediate"),
            ]
        )
        self.assertEqual(result[0].display_name, "Search databases")
        self.assertEqual(result[0].skill_id, "local:search-databases")
        self.assertEqual(result[0].taxonomy_source, "Local prototype vocabulary")
        self.assertFalse(result[0].is_custom)
        self.assertIsNone(result[1].skill_id)
        self.assertEqual(result[1].taxonomy_source, "Custom")
        self.assertTrue(result[1].is_custom)
        self.assertEqual(result[1].display_name, "Unlisted marine robotics")

    def test_explicit_custom_choice_is_not_auto_mapped_from_a_known_alias(self) -> None:
        result = normalize_skills(
            [SkillInput(name="python", force_custom=True, proficiency="intermediate")]
        )
        self.assertIsNone(result[0].skill_id)
        self.assertTrue(result[0].is_custom)
        self.assertEqual(result[0].display_name, "python")

    def test_duplicate_known_skills_merge_and_keep_highest_proficiency(self) -> None:
        result = normalize_skills(
            [
                SkillInput(name="python", proficiency="beginner"),
                SkillInput(name="Python programming", skill_id="local:python-programming", proficiency="advanced"),
            ]
        )
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].proficiency, "advanced")
        self.assertEqual(result[0].input_names, ["python", "Python programming"])

    def test_unknown_identifier_is_rejected(self) -> None:
        with self.assertRaises(UnknownSkillIdError):
            normalize_skills(
                [SkillInput(name="Python programming", skill_id="esco:unknown", proficiency="beginner")]
            )

    def test_verified_esco_identifier_is_preserved_as_an_esco_skill(self) -> None:
        from src.services.future_roles.occupation_index import get_occupation_index

        index = get_occupation_index()
        python = next(
            skill for skill in index.skills.values()
            if skill.skill_id.startswith("http://data.europa.eu/esco/skill/")
            and skill.name == "Python (computer programming)"
        )
        normalized = normalize_skills([
            SkillInput(name="Python", skill_id=python.skill_id, proficiency="intermediate")
        ])
        self.assertEqual(normalized[0].skill_id, python.skill_id)
        self.assertEqual(normalized[0].display_name, python.name)
        self.assertEqual(normalized[0].taxonomy_source, "ESCO v1.2.1")
        self.assertFalse(normalized[0].is_custom)

    def test_profile_create_get_and_update_round_trip(self) -> None:
        created = create_profile(profile_input(get_sample_profiles()[1]))
        fetched = get_profile(created.id)
        self.assertEqual(fetched, created)
        self.assertEqual(fetched.skills[0].taxonomy_source, "Local prototype vocabulary")

        updated_values = created.model_dump(mode="json")
        for key in ("id", "created_at", "updated_at"):
            updated_values.pop(key)
        updated_values["skills"] = [
            {
                "name": item["display_name"],
                "skill_id": item["skill_id"],
                "proficiency": item["proficiency"],
            }
            for item in updated_values["skills"]
        ]
        updated_values["career_aspirations"] = "Explore an evidence-informed data role."
        updated = update_profile(created.id, ProfileInput.model_validate(updated_values))
        self.assertIsNotNone(updated)
        self.assertEqual(updated.id, created.id)
        self.assertEqual(updated.created_at, created.created_at)
        self.assertEqual(updated.career_aspirations, "Explore an evidence-informed data role.")

    def test_missing_profile_returns_none(self) -> None:
        self.assertIsNone(get_profile("not-a-profile"))
        self.assertIsNone(update_profile("not-a-profile", profile_input(get_sample_profiles()[0])))


if __name__ == "__main__":
    unittest.main()
