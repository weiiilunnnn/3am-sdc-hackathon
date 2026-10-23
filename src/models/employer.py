"""Employer workforce dashboard contracts."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DepartmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=80)


class MemberDepartmentAssignment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    department_id: str | None = Field(default=None, min_length=1, max_length=80)


class DepartmentSkillTargets(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skill_ids: list[str] = Field(max_length=40)

    @field_validator("skill_ids")
    @classmethod
    def unique_skill_ids(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("Target skills must not contain duplicate IDs.")
        return value


class EmployerSkill(BaseModel):
    skill_id: str | None
    name: str
    proficiency: Literal["beginner", "intermediate", "advanced"]
    evidence_record_count: int = Field(ge=0)


class DepartmentSkillCoverage(BaseModel):
    skill_id: str
    skill_name: str
    member_count: int = Field(ge=0)
    members_with_skill: int = Field(ge=0)
    coverage_percent: float | None = Field(default=None, ge=0, le=100)
    gap_percent: float | None = Field(default=None, ge=0, le=100)


class EmployerDepartment(BaseModel):
    id: str
    name: str
    member_count: int = Field(ge=0)
    target_skill_ids: list[str]
    skill_coverage: list[DepartmentSkillCoverage]


class EmployerMember(BaseModel):
    id: str
    department_id: str | None
    department_name: str | None
    status: str
    field_of_study: str
    current_occupation: str | None
    years_experience: float = Field(ge=0)
    skills: list[EmployerSkill]
    skills_to_develop: list[str]
    evidence_coverage_percent: float | None = Field(default=None, ge=0, le=100)


class EmployerTeamDashboard(BaseModel):
    member_count: int = Field(ge=0)
    unassigned_count: int = Field(ge=0)
    departments: list[EmployerDepartment]
    members: list[EmployerMember]
    data_notice: str


class LearningPlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LearningPlanStep(BaseModel):
    skill_name: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=120)
    activity: str = Field(min_length=1, max_length=700)
    resource_type: Literal["guided practice", "project", "reading topic", "video topic", "peer exercise"]
    duration_hours: float = Field(gt=0, le=40)


class LearningPlan(BaseModel):
    member_id: str
    department_name: str
    summary: str = Field(min_length=1, max_length=500)
    steps: list[LearningPlanStep] = Field(min_length=1, max_length=12)
    model: Literal["RunPod GLM-5.3"]
    notice: str
