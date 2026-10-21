"""Evidence-aware observations adapter; scenarios never transform observed facts."""
from datetime import datetime, timezone

from .data_repository import supported
from .models import MarketOutlook, MarketSignalView, OccupationCatalog, Source, TrendSnapshot


def adapt_trend_snapshot(snapshot: TrendSnapshot | None, role_id: str, catalog: OccupationCatalog,
                         sources: dict[str, Source], *, now: datetime | None = None,
                         crosswalk: dict[str, str] | None = None) -> MarketOutlook:
    if snapshot is None:
        return MarketOutlook(warnings=["Market outlook unavailable: no trend snapshot supplied."])
    now = now or datetime.now(timezone.utc)
    crosswalk = crosswalk or {}
    role = next(r for r in catalog.occupations if r.role_id == role_id)
    role_skills = {s.skill_id for s in role.required_skills}
    role_ids = {r.role_id for r in catalog.occupations}
    skill_ids = {s.skill_id for s in catalog.skills}
    stale = snapshot.valid_until is not None and snapshot.valid_until < now
    freshness = "synthetic" if snapshot.is_synthetic else "stale" if stale else "fresh" if snapshot.valid_until else "unknown"
    result = MarketOutlook(snapshot_id=snapshot.snapshot_id, collected_at=snapshot.collected_at,
        evidence_status="synthetic" if snapshot.is_synthetic else "unverified", freshness_status=freshness)
    if snapshot.is_synthetic:
        result.warnings.append("Synthetic simulation; not observed labour-market evidence.")
    if not snapshot.refresh_method and not snapshot.is_synthetic:
        result.warnings.append("Refresh process not supplied by the signal owner.")
    for original in snapshot.signals:
        signal = original.model_copy(update={"role_id": crosswalk.get(original.role_id, original.role_id),
            "skill_id": crosswalk.get(original.skill_id, original.skill_id)})
        unmapped = bool(signal.role_id and signal.role_id not in role_ids or signal.skill_id and signal.skill_id not in skill_ids)
        if unmapped:
            result.warnings.append(f"Unmapped signal {signal.signal_id}; no role/skill association inferred.")
            continue
        if signal.scope == "role" and signal.role_id != role_id:
            continue
        if signal.scope == "skill" and (signal.skill_id not in role_skills or signal.role_id and signal.role_id != role_id):
            continue
        warnings = []
        evidence_ok = supported(signal.source_ids, sources, "trend_observation", synthetic=snapshot.is_synthetic)
        evidence_ok &= supported(snapshot.source_ids, sources, "trend_observation", synthetic=snapshot.is_synthetic)
        if not evidence_ok:
            warnings.append("Trend source is missing, unverified or does not support observations.")
        previous, current = signal.period_previous, signal.period_current
        if previous.end >= current.start:
            warnings.append("Observation windows overlap or are out of order.")
        if (previous.end - previous.start) != (current.end - current.start):
            warnings.append("Unequal observation windows are not directly compared.")
        if current.end > snapshot.collected_at.date() or snapshot.collected_at > now:
            warnings.append("Observation/collection date is in the future.")
        if not signal.comparability_confirmed:
            warnings.append("Signal owner has not confirmed metric/window/population comparability.")
        if not signal.region or signal.region == "unspecified" and not snapshot.is_synthetic:
            warnings.append("Source geography is unspecified.")
        direction = signal.direction
        if signal.comparison_method == "count_comparison_v1" and signal.direction_origin == "calculated":
            direction = "rising" if current.value > previous.value else "declining" if current.value < previous.value else "stable"
            if direction != signal.direction:
                warnings.append("Direction conflicts with the documented count comparison.")
        if stale:
            warnings.append("Snapshot is past its owner-supplied validity date.")
        if warnings:
            direction = "unknown"
        status = "stale" if stale else "unknown" if warnings else "available"
        result.signals.append(MarketSignalView(signal=signal, direction=direction, status=status,
            evidence_status="synthetic" if snapshot.is_synthetic else "verified" if evidence_ok else "unverified", warnings=warnings))
    valid_roles = [s for s in result.signals if s.signal.scope == "role" and s.status == "available"]
    # Multiple metrics stay separate; no invented aggregate direction.
    if len(valid_roles) == 1:
        result.direction = valid_roles[0].direction
    if not snapshot.is_synthetic and result.signals and all(s.evidence_status == "verified" for s in result.signals):
        result.evidence_status = "verified"
    if not result.signals:
        result.warnings.append("No mapped signal available for this role.")
    return result
