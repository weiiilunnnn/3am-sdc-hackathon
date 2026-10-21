"""Request and response contracts for the synthetic SDG dashboard."""

from pydantic import BaseModel, Field


class SDGSkill(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    goals: list[str] = Field(default_factory=list, max_length=10)


class SDGTarget(BaseModel):
    code: str = Field(pattern=r"^[0-9]{1,2}\.[0-9a-z]{1,2}$")
    title: str = Field(min_length=1, max_length=200)
    definition: str = Field(min_length=1, max_length=1000)


class SDGExplanationRequest(BaseModel):
    role: str = Field(min_length=1, max_length=120)
    role_summary: str = Field(min_length=1, max_length=500)
    target_code: str = Field(pattern=r"^[0-9]{1,2}\.[0-9a-z]{1,2}$")
    target_title: str = Field(min_length=1, max_length=200)
    target_definition: str = Field(min_length=1, max_length=1000)
    skills: list[SDGSkill] = Field(min_length=1, max_length=12)


class SDGOverviewRequest(BaseModel):
    role: str = Field(min_length=1, max_length=120)
    role_summary: str = Field(min_length=1, max_length=500)
    sdg_number: str = Field(pattern=r"^(?:[1-9]|1[0-7])$")
    targets: list[SDGTarget] = Field(min_length=1, max_length=10)
    skills: list[SDGSkill] = Field(min_length=1, max_length=12)


class SDGRecommendationRequest(BaseModel):
    role: str = Field(min_length=1, max_length=120)
