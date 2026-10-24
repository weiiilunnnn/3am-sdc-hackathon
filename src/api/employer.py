"""Employer prototype workforce dashboard endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from src.models.employer import DepartmentCreate, DepartmentSkillTargets, MemberDepartmentAssignment
from src.services.employer_service import (
    EmployerDepartmentNotFoundError,
    EmployerMemberNotFoundError,
    EmployerPlanInputError,
    assign_member_to_department,
    create_department,
    generate_learning_plan,
    get_team_dashboard,
    set_department_skill_targets,
)
from src.services.sources.runpod_api import RunPodRequestError

router = APIRouter(prefix="/api/employer", tags=["employer prototype"])


@router.get("/dashboard")
def employer_dashboard():
    try:
        return get_team_dashboard()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/departments", status_code=201)
def add_department(request: DepartmentCreate) -> dict[str, str]:
    try:
        return create_department(request.name)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.put("/members/{member_id}/department", status_code=204)
def update_member_department(member_id: str, request: MemberDepartmentAssignment) -> None:
    try:
        assign_member_to_department(member_id, request.department_id)
    except EmployerMemberNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EmployerDepartmentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/departments/{department_id}/targets", status_code=204)
def update_department_targets(department_id: str, request: DepartmentSkillTargets) -> None:
    try:
        set_department_skill_targets(department_id, request.skill_ids)
    except EmployerDepartmentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/members/{member_id}/learning-plan")
def employer_learning_plan(member_id: str):
    try:
        return generate_learning_plan(member_id)
    except EmployerMemberNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EmployerPlanInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RunPodRequestError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except (RuntimeError, ValidationError) as exc:
        raise HTTPException(status_code=500, detail="The employer learning plan could not be prepared.") from exc
