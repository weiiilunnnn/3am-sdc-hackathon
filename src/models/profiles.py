"""Profile intake and persistence response schemas."""

import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

ProfileListEntry = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]

Status = Literal["student", "fresh_graduate", "employed", "career_switcher", "other"]
Proficiency = Literal["beginner", "intermediate", "advanced"]
LearningMode = Literal["self_paced", "instructor_led", "peer_learning", "mixed"]


class LearningPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    weekly_hours: float | None = Field(default=None, ge=0, le=168)
    budget_myr: float | None = Field(default=None, ge=0, le=100000)
    mode: LearningMode | None = None


class SkillInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)
    skill_id: str | None = Field(default=None, max_length=180)
    proficiency: Proficiency
    force_custom: bool = False
    evidence_record_ids: list[str] = Field(default_factory=list, max_length=20)


class ProfileItem(BaseModel):
    """A user-confirmed education, experience, project, or credential record."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    id: str = Field(default_factory=lambda: uuid.uuid4().hex, min_length=1, max_length=80)
    title: str = Field(default="", max_length=160)
    organization: str | None = Field(default=None, max_length=160)
    period: str | None = Field(default=None, max_length=80)
    description: str = Field(default="", max_length=2000)
    skill_ids: list[str] = Field(default_factory=list, max_length=40)

    @model_validator(mode="after")
    def require_title_or_description(self) -> "ProfileItem":
        if not any((self.title.strip(), self.description.strip(), (self.organization or "").strip(), (self.period or "").strip())):
            raise ValueError("A profile record needs at least one detail.")
        return self


class ProfileInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    status: Status
    education_level: Literal["secondary", "certificate", "diploma", "bachelor", "postgraduate", "other"]
    field_of_study: str = Field(min_length=2, max_length=120)
    professional_summary: str = Field(default="", max_length=1200)
    current_occupation: str | None = Field(default=None, max_length=120)
    years_experience: float = Field(ge=0, le=70)
    skills: list[SkillInput] = Field(min_length=1, max_length=40)
    interests: list[ProfileListEntry] = Field(default_factory=list, max_length=20)
    work_activities: list[ProfileListEntry] = Field(default_factory=list, max_length=20)
    transferable_strengths: list[ProfileListEntry] = Field(default_factory=list, max_length=20)
    career_aspirations: str = Field(min_length=3, max_length=500)
    skills_to_develop: list[ProfileListEntry] = Field(default_factory=list, max_length=20)
    education: list[ProfileItem] = Field(default_factory=list, max_length=20)
    experience: list[ProfileItem] = Field(default_factory=list, max_length=20)
    projects: list[ProfileItem] = Field(default_factory=list, max_length=30)
    certifications: list[ProfileItem] = Field(default_factory=list, max_length=30)
    achievements: list[ProfileItem] = Field(default_factory=list, max_length=30)
    learning_preferences: LearningPreferences = Field(default_factory=LearningPreferences)
    synthetic_demo: Literal[True] = True

    @model_validator(mode="after")
    def evidence_links_reference_profile_records(self) -> "ProfileInput":
        record_ids = {
            item.id
            for section in (self.education, self.experience, self.projects, self.certifications, self.achievements)
            for item in section
        }
        for skill in self.skills:
            unknown = set(skill.evidence_record_ids) - record_ids
            if unknown:
                raise ValueError("Skill evidence must refer to a record in this profile.")
        return self


class NormalizedSkill(BaseModel):
    skill_id: str | None
    display_name: str
    input_names: list[str]
    proficiency: Proficiency
    taxonomy_source: Literal["Local prototype vocabulary", "Custom"]
    is_custom: bool
    evidence_record_ids: list[str] = Field(default_factory=list)


class ProfileRecord(ProfileInput):
    id: str
    created_at: str
    updated_at: str
    skills: list[NormalizedSkill]


class SampleProfile(ProfileInput):
    sample_id: str
    label: str
