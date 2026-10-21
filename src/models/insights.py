"""Transparent, rule-based profile indicators."""

from typing import Literal

from pydantic import BaseModel


class ProfileIndicator(BaseModel):
    id: str
    label: str
    status: Literal["available", "not_enough_information"]
    value_percent: float | None
    numerator: int | None
    denominator: int | None
    interpretation: str
    limitation: str


class ProfileInsights(BaseModel):
    profile_id: str
    indicators: list[ProfileIndicator]
    suggestions: list[str]
    notice: str
