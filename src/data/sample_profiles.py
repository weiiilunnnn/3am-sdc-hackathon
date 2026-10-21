"""Deterministic fictional profiles for offline demos."""

from __future__ import annotations

from copy import deepcopy
from typing import Any


def _skill(skill_id: str, name: str, proficiency: str = "intermediate") -> dict[str, str]:
    return {"skill_id": skill_id, "name": name, "proficiency": proficiency}


SAMPLE_PROFILES: list[dict[str, Any]] = [
    {
        "sample_id": "cs-student",
        "label": "Computer science student",
        "status": "student",
        "education_level": "bachelor",
        "field_of_study": "Computer science",
        "current_occupation": "",
        "years_experience": 0,
        "skills": [
            _skill("local:python-programming", "Python programming", "intermediate"),
            _skill("local:problem-solving", "Problem solving", "intermediate"),
            _skill("local:teamwork", "Teamwork", "beginner"),
        ],
        "interests": ["Artificial intelligence", "Education technology"],
        "work_activities": ["Building software", "Explaining technical ideas"],
        "transferable_strengths": ["Curiosity", "Persistence"],
        "career_aspirations": "Explore software and AI-related work after graduation.",
        "skills_to_develop": ["Machine learning", "Communication"],
        "learning_preferences": {"weekly_hours": 5, "budget_myr": 100, "mode": "self_paced"},
        "synthetic_demo": True,
    },
    {
        "sample_id": "data-graduate",
        "label": "Fresh graduate interested in data analysis",
        "status": "fresh_graduate",
        "education_level": "bachelor",
        "field_of_study": "Information systems",
        "current_occupation": "",
        "years_experience": 0,
        "skills": [
            _skill("local:data-analysis", "Data analysis", "intermediate"),
            _skill("local:spreadsheet-analysis", "Spreadsheet analysis", "advanced"),
            _skill("local:search-databases", "Search databases", "beginner"),
        ],
        "interests": ["Data", "Public services"],
        "work_activities": ["Finding patterns", "Preparing reports"],
        "transferable_strengths": ["Attention to detail", "Clear writing"],
        "career_aspirations": "Start in a role that uses data to improve services.",
        "skills_to_develop": ["Python programming", "Develop statistical software"],
        "learning_preferences": {"weekly_hours": 6, "budget_myr": 150, "mode": "mixed"},
        "synthetic_demo": True,
    },
    {
        "sample_id": "admin-worker",
        "label": "Administrative worker",
        "status": "employed",
        "education_level": "diploma",
        "field_of_study": "Business administration",
        "current_occupation": "Administrative assistant",
        "years_experience": 4,
        "skills": [
            _skill("local:spreadsheet-analysis", "Spreadsheet analysis", "intermediate"),
            _skill("local:communication", "Communication", "advanced"),
            _skill("local:project-planning", "Project planning", "intermediate"),
        ],
        "interests": ["Operations", "Digital services"],
        "work_activities": ["Organising information", "Helping colleagues"],
        "transferable_strengths": ["Reliability", "Organisation"],
        "career_aspirations": "Move toward digital operations or data-support work.",
        "skills_to_develop": ["Data analysis", "Python programming"],
        "learning_preferences": {"weekly_hours": 3, "budget_myr": 80, "mode": "self_paced"},
        "synthetic_demo": True,
    },
    {
        "sample_id": "career-switcher",
        "label": "Career switcher",
        "status": "career_switcher",
        "education_level": "bachelor",
        "field_of_study": "Communications",
        "current_occupation": "Retail supervisor",
        "years_experience": 6,
        "skills": [
            _skill("local:communication", "Communication", "advanced"),
            _skill("local:customer-service", "Customer service", "advanced"),
            _skill("local:teamwork", "Teamwork", "advanced"),
        ],
        "interests": ["Technology", "Customer experience"],
        "work_activities": ["Solving customer problems", "Coaching a team"],
        "transferable_strengths": ["Empathy", "Coaching"],
        "career_aspirations": "Explore technology-enabled customer operations.",
        "skills_to_develop": ["Data analysis", "Project planning"],
        "learning_preferences": {"weekly_hours": 4, "budget_myr": 120, "mode": "instructor_led"},
        "synthetic_demo": True,
    },
    {
        "sample_id": "sustainability-learner",
        "label": "Sustainability-focused learner",
        "status": "student",
        "education_level": "diploma",
        "field_of_study": "Environmental studies",
        "current_occupation": "",
        "years_experience": 1,
        "skills": [
            _skill("local:sustainability-literacy", "Sustainability literacy", "advanced"),
            _skill("local:data-analysis", "Data analysis", "beginner"),
            _skill("local:communication", "Communication", "intermediate"),
        ],
        "interests": ["Climate action", "Circular economy"],
        "work_activities": ["Researching", "Sharing practical recommendations"],
        "transferable_strengths": ["Systems thinking", "Advocacy"],
        "career_aspirations": "Help organisations make evidence-informed sustainability decisions.",
        "skills_to_develop": ["Spreadsheet analysis", "Search databases"],
        "learning_preferences": {"weekly_hours": 5, "budget_myr": 100, "mode": "peer_learning"},
        "synthetic_demo": True,
    },
]


def get_sample_profiles() -> list[dict[str, Any]]:
    profiles = deepcopy(SAMPLE_PROFILES)
    for profile in profiles:
        profile.setdefault("professional_summary", "")
        for section in ("education", "experience", "projects", "certifications", "achievements"):
            profile.setdefault(section, [])
        for skill in profile["skills"]:
            skill.setdefault("evidence_record_ids", [])
    return profiles
