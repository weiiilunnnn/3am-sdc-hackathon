"""Workforce aggregates and privacy-minimized employer learning plans."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError

from src.data.skills_taxonomy import find_skill_by_id
from src.models.employer import (
    DepartmentSkillCoverage,
    EmployerDepartment,
    EmployerMember,
    EmployerSkill,
    EmployerTeamDashboard,
    LearningPlan,
    LearningPlanStep,
)
from src.models.profiles import ProfileRecord
from src.services.profile_service import utc_now
from src.services.sdg_text import LLM_ENDPOINT_ID
from src.services.sources.runpod_api import RunPodRequestError, run_sync, unwrap_llm_output
from src.services.storage import connection, initialize_database

DATA_NOTICE = (
    "Contains synthetic-demo profiles from the shared database. Current skill levels and development interests "
    "are profile entries, not independently assessed capability or verified company requirements. "
    "Departments and target skills are employer-entered. No HR authentication or company-level access control is implemented."
)


class EmployerMemberNotFoundError(ValueError):
    """Raised when the requested synthetic profile does not exist."""


class EmployerDepartmentNotFoundError(ValueError):
    """Raised when a department does not exist."""


class EmployerPlanInputError(ValueError):
    """Raised when a member has no department target skills to plan against."""


def _load_profiles(rows: list[sqlite3.Row]) -> list[ProfileRecord]:
    profiles: list[ProfileRecord] = []
    for row in rows:
        try:
            payload = json.loads(row["payload"])
            if not isinstance(payload, dict) or payload.get("synthetic_demo") is not True:
                continue
            payload.update(id=row["id"], created_at=row["created_at"], updated_at=row["updated_at"])
            profiles.append(ProfileRecord.model_validate(payload))
        except (json.JSONDecodeError, ValidationError) as exc:
            raise RuntimeError("A stored synthetic profile is invalid and cannot be included in the employer view.") from exc
    return profiles


def get_team_dashboard() -> EmployerTeamDashboard:
    initialize_database()
    with connection() as db:
        rows = db.execute("SELECT id, payload, created_at, updated_at FROM profiles ORDER BY created_at, id").fetchall()
        departments = db.execute("SELECT id, name FROM employer_departments ORDER BY name COLLATE NOCASE").fetchall()
        assignments = {
            row["member_id"]: (row["department_id"], row["name"])
            for row in db.execute(
                """SELECT assignment.member_id, department.id AS department_id, department.name
                   FROM employer_member_departments AS assignment
                   JOIN employer_departments AS department ON department.id = assignment.department_id"""
            ).fetchall()
        }
        targets: dict[str, list[str]] = {}
        for row in db.execute(
            "SELECT department_id, skill_id FROM employer_department_skill_targets ORDER BY skill_id"
        ).fetchall():
            targets.setdefault(row["department_id"], []).append(row["skill_id"])

    profiles = _load_profiles(rows)
    members: list[EmployerMember] = []
    department_members: dict[str, list[ProfileRecord]] = {}
    for profile in profiles:
        assigned = assignments.get(profile.id)
        department_id, department_name = assigned if assigned else (None, None)
        if department_id:
            department_members.setdefault(department_id, []).append(profile)
        skills = [
            EmployerSkill(
                skill_id=skill.skill_id,
                name=skill.display_name,
                proficiency=skill.proficiency,
                evidence_record_count=len(skill.evidence_record_ids),
            )
            for skill in profile.skills
        ]
        evidence_count = sum(bool(skill.evidence_record_ids) for skill in profile.skills)
        evidence_coverage = (evidence_count / len(profile.skills) * 100) if profile.skills else None
        members.append(
            EmployerMember(
                id=profile.id,
                department_id=department_id,
                department_name=department_name,
                status=profile.status,
                field_of_study=profile.field_of_study,
                current_occupation=profile.current_occupation,
                years_experience=profile.years_experience,
                skills=skills,
                skills_to_develop=profile.skills_to_develop,
                evidence_coverage_percent=round(evidence_coverage, 1) if evidence_coverage is not None else None,
            )
        )

    department_views: list[EmployerDepartment] = []
    for department in departments:
        department_id = department["id"]
        team = department_members.get(department_id, [])
        team_skill_ids = {
            skill.skill_id
            for profile in team
            for skill in profile.skills
            if skill.skill_id is not None
        }
        coverage: list[DepartmentSkillCoverage] = []
        for skill_id in targets.get(department_id, []):
            taxonomy_skill = find_skill_by_id(skill_id)
            if taxonomy_skill is None:
                raise RuntimeError(f"Department {department_id} refers to an unsupported skill identifier.")
            members_with_skill = sum(
                any(skill.skill_id == skill_id for skill in profile.skills)
                for profile in team
            )
            percent = (members_with_skill / len(team) * 100) if team else None
            coverage.append(
                DepartmentSkillCoverage(
                    skill_id=skill_id,
                    skill_name=taxonomy_skill["name"],
                    member_count=len(team),
                    members_with_skill=members_with_skill,
                    coverage_percent=round(percent, 1) if percent is not None else None,
                    gap_percent=round(100 - percent, 1) if percent is not None else None,
                )
            )
        department_views.append(
            EmployerDepartment(
                id=department_id,
                name=department["name"],
                member_count=len(team),
                target_skill_ids=targets.get(department_id, []),
                skill_coverage=coverage,
            )
        )

    return EmployerTeamDashboard(
        member_count=len(members),
        unassigned_count=sum(member.department_id is None for member in members),
        departments=department_views,
        members=members,
        data_notice=DATA_NOTICE,
    )


def create_department(name: str) -> dict[str, str]:
    initialize_database()
    department_id = uuid.uuid4().hex
    try:
        with connection() as db:
            db.execute(
                "INSERT INTO employer_departments (id, name, created_at) VALUES (?, ?, ?)",
                (department_id, name, utc_now()),
            )
    except sqlite3.IntegrityError as exc:
        raise ValueError("A department with this name already exists.") from exc
    return {"id": department_id, "name": name}


def assign_member_to_department(member_id: str, department_id: str | None) -> None:
    initialize_database()
    with connection() as db:
        member = db.execute("SELECT payload FROM profiles WHERE id = ?", (member_id,)).fetchone()
        if member is None:
            raise EmployerMemberNotFoundError("Profile not found.")
        payload = json.loads(member["payload"])
        if not isinstance(payload, dict) or payload.get("synthetic_demo") is not True:
            raise EmployerMemberNotFoundError("Synthetic demo profile not found.")
        if department_id is None:
            db.execute("DELETE FROM employer_member_departments WHERE member_id = ?", (member_id,))
            return
        department = db.execute("SELECT id FROM employer_departments WHERE id = ?", (department_id,)).fetchone()
        if department is None:
            raise EmployerDepartmentNotFoundError("Department not found.")
        db.execute(
            """INSERT INTO employer_member_departments (member_id, department_id) VALUES (?, ?)
               ON CONFLICT(member_id) DO UPDATE SET department_id = excluded.department_id""",
            (member_id, department_id),
        )


def set_department_skill_targets(department_id: str, skill_ids: list[str]) -> None:
    initialize_database()
    invalid = [skill_id for skill_id in skill_ids if find_skill_by_id(skill_id) is None]
    if invalid:
        raise ValueError(f"Unsupported skill identifier: {invalid[0]}")
    with connection() as db:
        department = db.execute("SELECT id FROM employer_departments WHERE id = ?", (department_id,)).fetchone()
        if department is None:
            raise EmployerDepartmentNotFoundError("Department not found.")
        db.execute("DELETE FROM employer_department_skill_targets WHERE department_id = ?", (department_id,))
        db.executemany(
            "INSERT INTO employer_department_skill_targets (department_id, skill_id) VALUES (?, ?)",
            [(department_id, skill_id) for skill_id in skill_ids],
        )


def _plan_context(member_id: str) -> tuple[ProfileRecord, str, list[dict[str, str]]]:
    dashboard = get_team_dashboard()
    member = next((item for item in dashboard.members if item.id == member_id), None)
    if member is None:
        raise EmployerMemberNotFoundError("Synthetic demo profile not found.")
    if member.department_id is None:
        raise EmployerPlanInputError("Assign this profile to a department before generating a learning plan.")
    department = next(item for item in dashboard.departments if item.id == member.department_id)
    missing_ids = [
        target.skill_id
        for target in department.skill_coverage
        if not any(skill.skill_id == target.skill_id for skill in member.skills)
    ]
    if not missing_ids:
        raise EmployerPlanInputError("This profile has no gaps against the department's current target skills.")
    if len(missing_ids) > 12:
        raise EmployerPlanInputError("A learning plan can cover up to 12 target skill gaps at a time.")
    with connection() as db:
        row = db.execute(
            "SELECT payload FROM profiles WHERE id = ?",
            (member_id,),
        ).fetchone()
    if row is None:
        raise EmployerMemberNotFoundError("Synthetic demo profile not found.")
    payload = json.loads(row["payload"])
    payload.update(id=member_id, created_at="", updated_at="")
    try:
        profile = ProfileRecord.model_validate(payload)
    except ValidationError as exc:
        raise RuntimeError("The selected synthetic profile is invalid and cannot be used for a learning plan.") from exc
    missing = [
        {"name": find_skill_by_id(skill_id)["name"], "skill_id": skill_id}
        for skill_id in missing_ids
    ]
    return profile, department.name, missing


def generate_learning_plan(member_id: str) -> LearningPlan:
    profile, department_name, target_skills = _plan_context(member_id)
    current_skills = [
        {"name": skill.display_name, "proficiency": skill.proficiency}
        for skill in profile.skills
    ]
    learning_preferences = profile.learning_preferences.model_dump(mode="json")
    prompt_data = {
        "department_target_gaps": [{"name": skill["name"]} for skill in target_skills],
        "current_self_reported_skills": current_skills,
        "learning_preferences": learning_preferences,
    }
    system_prompt = (
        "Create a practical learning plan for a fictional employee using only the supplied target skill gaps, "
        "self-reported current skills, and learning preferences. Return JSON only with a short summary and steps. "
        "Each step must use one exact supplied target skill name, one allowed resource_type "
        "(guided practice, project, reading topic, video topic, peer exercise), a short title, an actionable activity, "
        "and a realistic duration_hours number. Include exactly one step per supplied target skill and do not invent "
        "course providers, URLs, certifications, or claims that a resource exists. Never infer proficiency beyond "
        "the supplied self-reported values."
    )
    request_payload: dict[str, Any] = {
        "input": {
            "model": "glm-5.3",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(prompt_data, ensure_ascii=False)},
            ],
            "temperature": 0.2,
            "max_tokens": 1200,
            "response_format": {"type": "json_object"},
        }
    }
    endpoint_id = os.getenv("RUNPOD_LLM_ENDPOINT_ID", LLM_ENDPOINT_ID)
    result = run_sync(endpoint_id, request_payload, timeout=90)
    output = unwrap_llm_output(result)
    try:
        generated = json.loads(output["choices"][0]["message"]["content"])
        summary = generated["summary"]
        raw_steps = generated["steps"]
        allowed_skills = {skill["name"] for skill in target_skills}
        if not isinstance(summary, str) or not isinstance(raw_steps, list):
            raise ValueError("The generated learning plan has an invalid shape.")
        steps = [LearningPlanStep.model_validate(item) for item in raw_steps]
        if (
            {step.skill_name for step in steps} != allowed_skills
            or len(steps) != len(allowed_skills)
        ):
            raise ValueError("The generated learning plan did not cover the requested skill gaps.")
        return LearningPlan(
            member_id=member_id,
            department_name=department_name,
            summary=summary,
            steps=steps,
            model="RunPod GLM-5.3",
            notice=(
                "AI-generated learning activities, not verified courses or links. Skill levels are self-reported; "
                "department targets are employer-entered. Review before assigning."
            ),
        )
    except (KeyError, IndexError, TypeError, ValueError, ValidationError, json.JSONDecodeError) as exc:
        raise RunPodRequestError("RunPod returned an invalid employer learning plan.") from exc
