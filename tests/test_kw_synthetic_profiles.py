import unittest

from scripts.generate_kw_synthetic_profiles import generate_rows


class KwSyntheticProfilesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.occupations = [
            {"role_id": "role-1", "title": "Example occupation"},
            {"role_id": "role-2", "title": "Another occupation"},
        ]
        self.skills = [
            {"skill_id": "skill-1", "name": "Skill one"},
            {"skill_id": "skill-2", "name": "Skill two"},
            {"skill_id": "skill-3", "name": "Skill three"},
            {"skill_id": "skill-4", "name": "Skill four"},
        ]
        self.essential = [
            {"role_id": "role-1", "skill_id": "skill-1"},
            {"role_id": "role-1", "skill_id": "skill-2"},
            {"role_id": "role-2", "skill_id": "skill-3"},
        ]
        self.optional = [{"role_id": "role-1", "skill_id": "skill-3"}]

    def test_generated_profiles_use_known_kw_skill_ids_and_separate_targets(self) -> None:
        generated = list(
            generate_rows(
                self.occupations,
                self.skills,
                self.essential,
                self.optional,
                count=20,
                seed=7,
            )
        )

        self.assertEqual(len(generated), 20)
        for profile, target in generated:
            self.assertTrue(profile["is_synthetic"])
            self.assertEqual(profile["schema_version"], "1.0")
            self.assertEqual(profile["profile_id"], target["profile_id"])
            self.assertNotIn("synthetic_target_role_id", profile)
            profile_skill_ids = {skill["skill_id"] for skill in profile["skills"]}
            target_requirements = (
                {"skill-1", "skill-2", "skill-3"}
                if target["synthetic_target_role_id"] == "role-1"
                else {"skill-3"}
            )
            unrelated_ids = profile_skill_ids - target_requirements
            self.assertEqual(target["unrelated_skill_count"], len(unrelated_ids))
            for skill in profile["skills"]:
                self.assertIn(
                    skill["skill_id"],
                    {"skill-1", "skill-2", "skill-3", "skill-4"},
                )
                self.assertEqual(skill["proficiency"], "unknown")
                self.assertTrue(skill["self_reported"])

    def test_generation_is_reproducible_for_same_seed(self) -> None:
        first = list(
            generate_rows(
                self.occupations,
                self.skills,
                self.essential,
                self.optional,
                count=10,
                seed=11,
            )
        )
        second = list(
            generate_rows(
                self.occupations,
                self.skills,
                self.essential,
                self.optional,
                count=10,
                seed=11,
            )
        )
        self.assertEqual(first, second)

    def test_unknown_relationship_ids_are_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "unknown skill ID"):
            list(
                generate_rows(
                    self.occupations,
                    self.skills,
                    [{"role_id": "role-1", "skill_id": "missing"}],
                    self.optional,
                    count=1,
                    seed=1,
                )
            )

    def test_empty_essential_relationships_are_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "no occupations with essential"):
            list(
                generate_rows(
                    self.occupations,
                    self.skills,
                    [],
                    self.optional,
                    count=1,
                    seed=1,
                )
            )


if __name__ == "__main__":
    unittest.main()
