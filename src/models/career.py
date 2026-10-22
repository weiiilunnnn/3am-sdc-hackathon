"""Request and response contracts for synthetic career recommendations."""

from pydantic import BaseModel, Field


class CareerProfileRequest(BaseModel):
    major: str = Field(default="data_science", min_length=1, max_length=80)
    interests: list[str] = Field(default_factory=list, max_length=7)
    skills: list[str] = Field(default_factory=list, max_length=6)
    experience_months: int = Field(default=6, ge=0, le=240)
