"use client";
import { useState } from "react";
import type { Requirement, Source } from "@/lib/contracts";
import SourceLinks from "./SourceLinks";

export default function RequirementsExplorer({ items, sources }: { items: (Requirement & { listed: boolean })[]; sources: Source[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = items.filter(s => (filter === "all" || s.listed === (filter === "listed")) && `${s.name} ${s.skill_id}`.toLowerCase().includes(query.toLowerCase()));
  return <details className="requirements-explorer"><summary>View all documented requirements ({items.length})</summary>
    <div className="requirement-filters"><label>Search requirements<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label>Requirement status<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All requirements</option><option value="listed">Listed in profile</option><option value="missing">Missing from profile</option></select></label></div>
    {!filtered.length && <p className="small muted" role="status">No requirements match these filters.</p>}
    <div className="requirement-scroll">{["essential", "optional", "unspecified"].flatMap(importance => ["skill", "knowledge", "unknown"].map(kind => {
      const group = filtered.filter(s => s.requirement === importance && s.skill_type === kind);
      return group.length ? <details className="requirement-group" key={`${importance}-${kind}`}><summary>{importance} · {kind === "skill" ? "Skills / competences" : kind === "knowledge" ? "Knowledge" : "Other documented requirements (type unknown)"} ({group.length})</summary>
        {group.map(s => <details className="requirement" key={s.skill_id}><summary>{s.listed ? "✓" : "○"} {s.name}<span className="tiny-tag">{s.listed ? "listed" : "missing"}</span></summary><p className="record-id micro">{s.skill_id}</p><SourceLinks ids={s.source_ids} sources={sources} label="Evidence for this requirement" /></details>)}</details> : null;
    }))}</div></details>;
}
