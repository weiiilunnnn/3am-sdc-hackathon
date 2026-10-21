"""Profile intake and persistence response schemas."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

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


class ProfileInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    status: Status
    education_level: Literal["secondary", "certificate", "diploma", "bachelor", "postgraduate", "other"]
    field_of_study: str = Field(min_length=2, max_length=120)
    current_occupation: str | None = Field(default=None, max_length=120)
    years_experience: float = Field(ge=0, le=70)
    skills: list[SkillInput] = Field(min_length=1, max_length=40)
    interests: list[str] = Field(default_factory=list, max_length=20)
    work_activities: list[str] = Field(default_factory=list, max_length=20)
    transferable_strengths: list[str] = Field(default_factory=list, max_length=20)
    career_aspirations: str = Field(min_length=3, max_length=500)
    skills_to_develop: list[str] = Field(default_factory=list, max_length=20)
    learning_preferences: LearningPreferences = Field(default_factory=LearningPreferences)
    synthetic_demo: Literal[True] = True


class NormalizedSkill(BaseModel):
    skill_id: str | None
    display_name: str
    input_names: list[str]
    proficiency: Proficiency
    taxonomy_source: Literal["Local prototype vocabulary", "Custom"]
    is_custom: bool


class ProfileRecord(ProfileInput):
    id: str
    created_at: str
    updated_at: str
    skills: list[NormalizedSkill]


class SampleProfile(ProfileInput):
    sample_id: str
    label: str
