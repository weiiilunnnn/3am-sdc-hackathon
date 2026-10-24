"""Bounded user decisions; sourced labels/provenance are resolved on the server."""
from datetime import date
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


RoleID = Annotated[str, Field(min_length=1, max_length=200)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Exploration(Strict):
    profile_id: str = Field(min_length=1, max_length=100)
    from_role_id: str | None = Field(default=None, max_length=200)
    route: list[RoleID] = Field(default_factory=list, max_length=9)
    query: str = Field(default="", max_length=100)
    offset: int = Field(default=0, ge=0, le=10000)
    sort: Literal["overlap", "title"] = "overlap"
    role_id: str | None = Field(default=None, max_length=200)


class Timing(Strict):
    start_date: date | None = None
    end_date: date | None = None
    relative_year: int | None = Field(default=None, ge=0, le=80)
    duration_months: int | None = Field(default=None, ge=1, le=1200)
    notes: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def chronology(self):
        for value in (self.start_date, self.end_date):
            if value and not 1900 <= value.year <= 2200:
                raise ValueError("Dates must be between 1900 and 2200")
        if self.end_date and not self.start_date:
            raise ValueError("Choose a start date before an end date")
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date must not precede start date")
        if self.relative_year is not None and self.start_date:
            raise ValueError("Choose a calendar date or relative year, not both")
        return self


class Chapter(Timing):
    role_id: str = Field(min_length=1, max_length=200)


class Milestone(Timing):
    id: str = Field(pattern=r"^[a-f0-9]{32}$")
    kind: Literal["skill", "goal", "break"]
    title: str = Field(min_length=1, max_length=160)
    order: int = Field(ge=0, le=200)
    role_id: str | None = Field(default=None, max_length=200)
    skill_id: str | None = Field(default=None, max_length=200)
    category: str = Field(default="custom", max_length=60)
    after_id: str | None = Field(default=None, max_length=205, pattern=r"^(?:role:.{1,200}|[a-f0-9]{32})$")


class PlanWrite(Strict):
    plan_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")
    profile_id: str = Field(min_length=1, max_length=100)
    revision: int = Field(ge=0)
    route: list[RoleID] = Field(default_factory=list, max_length=9)
    accepted: bool = False
    chapters: list[Chapter] = Field(default_factory=list, max_length=9)
    milestones: list[Milestone] = Field(default_factory=list, max_length=100)
    acknowledge_evidence_change: bool = False

    @model_validator(mode="after")
    def unique_items(self):
        for values in (self.route, [c.role_id for c in self.chapters], [m.id for m in self.milestones],
                       [m.order for m in self.milestones]):
            if len(set(values)) != len(values):
                raise ValueError("Repeated roles, chapter IDs, milestone IDs or orders")
        anchors = {m.id: m.after_id for m in self.milestones}
        for milestone_id in anchors:
            seen = {milestone_id}
            anchor = anchors[milestone_id]
            while anchor in anchors:
                if anchor in seen:
                    raise ValueError("Cyclic milestone placement")
                seen.add(anchor)
                anchor = anchors[anchor]
        skills = [(m.role_id, m.skill_id) for m in self.milestones if m.kind == "skill"]
        if len(set(skills)) != len(skills):
            raise ValueError("Duplicate skill milestone for the same occupation")
        return self
