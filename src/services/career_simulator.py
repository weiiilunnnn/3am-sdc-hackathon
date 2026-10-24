"""Deterministic local ESCO exploration and capability-scoped, revisioned plans."""
import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from fastapi import HTTPException
from src.services.storage import connection, initialize_database
from src.services.profile_service import get_profile
from src.services.future_roles.occupation_index import get_occupation_index
from src.services.future_roles.workspace_profile import adapt_workspace_profile
from src.services.future_roles.data_repository import supported

METHOD = "esco-essential-skill-overlap-v1"


def config(index=None):
    index = index or get_occupation_index()
    try:
        cap = max(1, min(8, int(os.getenv("CAREER_SIMULATOR_MAX_DESTINATION_STEPS", "3"))))
    except ValueError:
        cap = 3
    return {"max_destination_steps": cap, "candidate_limit": 6, "coverage": index.coverage,
            "dataset_version": index.catalog.dataset_version, "index_fingerprint": index.fingerprint,
            "available": index.coverage == "local_full" and not index.catalog.is_synthetic,
            "security_mode": "browser_capability_demo", "method": METHOD}


def profile(profile_id, index):
    saved = get_profile(profile_id)
    if not saved:
        raise HTTPException(404, "Save a profile before using the simulator")
    return adapt_workspace_profile(saved, index)


def require_full(index):
    if not config(index)["available"]:
        raise HTTPException(503, "Full verified ESCO index unavailable. Restore the pinned index; saved plans are retained.")


def role(rid, index):
    r = index.roles.get(rid)
    if (not r or r.evidence_status != "verified" or not r.requirements_complete
            or not supported(r.source_ids, index.sources, "occupation", native_id=rid)
            or any(index.sources[s].dataset_version != index.catalog.dataset_version for s in r.source_ids)
            or sum(s.requirement == "essential" for s in r.required_skills) != r.expected_essential_count):
        raise HTTPException(422, "Occupation evidence unavailable or incomplete")
    for req in r.required_skills:
        if (req.skill_id not in index.skills or not supported(req.source_ids, index.sources, "role_skill_relationships", native_id=rid)
                or not supported(index.skills[req.skill_id].source_ids, index.sources, "skill_labels")):
            raise HTTPException(422, "Occupation skill provenance unavailable")
    return r


def essential(r):
    return {s.skill_id for s in r.required_skills if s.requirement == "essential"}


def describe(r, have, index, previous=None):
    common = essential(r) & essential(previous) if previous else set()
    missing = essential(r) - have
    ids = set(r.source_ids) | {s for req in r.required_skills for s in req.source_ids}
    requirements = [{**req.model_dump(), "not_evidenced": req.skill_id not in have,
                     "source_urls": [index.sources[s].url for s in req.source_ids]} for req in r.required_skills]
    return {"role_id": r.role_id, "title": r.title, "description": r.description,
            "from_role_id": previous.role_id if previous else None,
            "requirements": requirements, "shared_essential_skills": [{"skill_id": s, "name": index.skills[s].name} for s in sorted(common)],
            "not_evidenced_essential_skill_ids": sorted(missing), "overlap_count": len(common),
            "evidence_kind": "documented_skill_overlap" if common else "user_selected_aspiration",
            "explanation": "Suggested via shared documented skills; not a verified career progression." if common else
                "User-selected aspiration — insufficient documented overlap to recommend a related transition.",
            "source_ids": sorted(ids), "source_urls": sorted({index.sources[s].url for s in ids if index.sources[s].url}),
            "dataset_version": index.catalog.dataset_version, "relation_method": METHOD}


def explore(request, index=None, *, search=False, detail=False):
    index = index or get_occupation_index()
    require_full(index)
    have = {s.skill_id for s in profile(request.profile_id, index).skills}
    if len(request.route) != len(set(request.route)) or len(request.route) > config(index)["max_destination_steps"]+1:
        raise HTTPException(422, "Invalid or over-limit path")
    for rid in request.route:
        role(rid, index)
    previous = role(request.from_role_id, index) if request.from_role_id else None
    if detail:
        return {"config": config(index), "role": describe(role(request.role_id, index), have, index, previous)}
    if not search and not previous:
        raise HTTPException(422, "Choose a starting occupation")
    if not search and len(request.route) >= config(index)["max_destination_steps"]+1:
        return {"config": config(index), "results": [], "next_offset": None}
    pool = set(index.roles) if search else set().union(*(index.reverse.get(s, set()) for s in essential(previous)))
    query = " ".join(request.query.casefold().split())
    rows = []
    for rid in pool - set(request.route):
        r = index.roles[rid]
        if previous and rid == previous.role_id:
            continue
        if query and query not in " ".join([r.title, *r.aliases]).casefold():
            continue
        try:
            role(rid, index)
        except HTTPException:
            continue
        overlap = len(essential(r) & essential(previous)) if previous else 0
        if not search and not overlap:
            continue
        rows.append((r, overlap))
    rows.sort(key=lambda pair: ((-pair[1] if request.sort == "overlap" else 0), pair[0].title.casefold(), pair[0].role_id))
    limit = config(index)["candidate_limit"]
    page = rows[request.offset:request.offset+limit]
    return {"config": config(index), "results": [describe(r, have, index, previous) for r, _ in page],
            "next_offset": request.offset+limit if request.offset+limit < len(rows) else None}


def scope(token):
    return hashlib.sha256(("career-simulator-demo:"+token).encode()).hexdigest()


def initialize():
    initialize_database()
    with connection() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS career_simulator_plans (
            plan_id TEXT PRIMARY KEY, owner_scope TEXT NOT NULL, profile_id TEXT NOT NULL,
            revision INTEGER NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
            UNIQUE(owner_scope, profile_id))""")


def _row(db, owner, pid):
    return db.execute("SELECT * FROM career_simulator_plans WHERE owner_scope=? AND profile_id=?", (owner, pid)).fetchone()


def view(row, index):
    if not row:
        return None
    plan = json.loads(row["payload"])
    changed = plan["index_fingerprint"] != index.fingerprint or plan["esco_version"] != index.catalog.dataset_version
    plan.update(plan_id=row["plan_id"], revision=row["revision"], created_at=row["created_at"], updated_at=row["updated_at"],
                evidence_changed=changed, over_limit=len(plan["route"]) > config(index)["max_destination_steps"]+1)
    for m in plan["milestones"]:
        if m["kind"] == "skill" and (changed or m["role_id"] not in plan["route"][1:]):
            m["review_status"] = "needs_review"
    return plan


def read_plan(pid, token, index=None):
    index = index or get_occupation_index()
    profile(pid, index)
    initialize()
    with connection() as db:
        return {"config": config(index), "plan": view(_row(db, scope(token), pid), index)}


def save_plan(request, token, index=None):
    index = index or get_occupation_index()
    require_full(index)
    original = profile(request.profile_id, index)
    if len(request.route) > config(index)["max_destination_steps"]+1 or (request.accepted and len(request.route) < 2):
        raise HTTPException(422, "Choose a start and destination within the configured step limit")
    for rid in request.route:
        role(rid, index)
    if any(c.role_id not in request.route for c in request.chapters):
        raise HTTPException(422, "Chapter occupation is outside the selected path")
    initialize()
    owner = scope(token)
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        old = _row(db, owner, request.profile_id)
        if request.revision != (old["revision"] if old else 0):
            raise HTTPException(409, "Journey changed in another tab. Keep your draft and reload for review.")
        if (old and request.plan_id != old["plan_id"]) or (not old and request.plan_id is not None):
            raise HTTPException(409, "Journey identity changed. Reload for review.")
        previous = json.loads(old["payload"]) if old else {}
        if old and previous["index_fingerprint"] != index.fingerprint and not request.acknowledge_evidence_change:
            raise HTTPException(409, "Evidence changed — review your saved plan before saving")
        prior = {m["id"]: m for m in previous.get("milestones", [])}
        entries = []
        for m in request.milestones:
            item = m.model_dump(mode="json")
            item.update(origin="user_entry", review_status="active", source_ids=[], requirement=None)
            if m.kind == "skill":
                old_item = prior.get(m.id)
                retained = old_item and old_item["kind"] == "skill" and old_item["role_id"] == m.role_id and old_item["skill_id"] == m.skill_id
                if m.role_id not in request.route[1:] and not retained:
                    raise HTTPException(422, "Choose a skill from a selected destination")
                r = index.roles.get(m.role_id)
                req = next((s for s in r.required_skills if s.skill_id == m.skill_id), None) if r else None
                if not req:
                    if not retained:
                        raise HTTPException(422, "Unknown documented skill requirement")
                    item.update(title=old_item["title"], source_ids=old_item["source_ids"], requirement=old_item["requirement"], review_status="needs_review")
                else:
                    role(m.role_id, index)
                    item.update(title=req.name, source_ids=req.source_ids, requirement=req.requirement)
                item.update(origin="esco_requirement")
                if m.role_id not in request.route[1:]:
                    item["review_status"] = "needs_review"
            elif m.role_id or m.skill_id:
                raise HTTPException(422, "Personal entries cannot assert ESCO evidence")
            entries.append(item)
        payload = {"schema_version": "1.0", "profile_id": request.profile_id,
                   "route": request.route, "accepted": request.accepted,
                   "chapters": [c.model_dump(mode="json") for c in request.chapters], "milestones": entries,
                   "esco_version": index.catalog.dataset_version, "index_fingerprint": index.fingerprint}
        now = datetime.now(timezone.utc).isoformat()
        if old:
            db.execute("UPDATE career_simulator_plans SET revision=revision+1,payload=?,updated_at=? WHERE plan_id=?",
                       (json.dumps(payload), now, old["plan_id"]))
        else:
            db.execute("INSERT INTO career_simulator_plans VALUES (?,?,?,?,?,?,?)",
                       (uuid.uuid4().hex, owner, request.profile_id, 1, json.dumps(payload), now, now))
        return {"config": config(index), "plan": view(_row(db, owner, request.profile_id), index)}


def delete_plan(pid, revision, token, plan_id=None):
    initialize()
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        row = _row(db, scope(token), pid)
        if row and (row["revision"] != revision or row["plan_id"] != plan_id):
            raise HTTPException(409, "Journey changed; reload before deleting")
        if row:
            db.execute("DELETE FROM career_simulator_plans WHERE plan_id=?", (row["plan_id"],))
    return {"deleted": bool(row)}
