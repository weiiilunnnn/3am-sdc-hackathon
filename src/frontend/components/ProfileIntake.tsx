"use client";
import { FormEvent, useEffect, useState } from "react";
import type { Bootstrap, Profile, Proficiency, Skill } from "@/lib/contracts";
import { request } from "@/lib/api";
export default function ProfileIntake({ data, profile, onChange, onSubmit, busy, onSkillsLoaded }: { data: Bootstrap; profile: Profile; onChange: (p: Profile) => void; onSubmit: () => void; busy: boolean; onSkillsLoaded?: (skills: Skill[]) => void }) {
  const [search, setSearch] = useState("");
  const [extra, setExtra] = useState((profile.unresolved_skills ?? []).join(", "));
  const [interests, setInterests] = useState(profile.interests.join(", "));
  useEffect(() => { setExtra((profile.unresolved_skills ?? []).join(", ")); setInterests(profile.interests.join(", ")); }, [profile.profile_id]);
  const [filtered, setFiltered] = useState(data.skills.slice(0, 40));
  const [searchTotal, setSearchTotal] = useState(data.skill_count ?? data.skills.length);
  const [searchError, setSearchError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try { const found = await request<{ skills: Skill[]; total: number }>(`/api/v2/skills?q=${encodeURIComponent(search)}`, undefined, controller.signal); if (!controller.signal.aborted) { setFiltered(found.skills); setSearchTotal(found.total); setSearchError(""); } }
      catch { if (!controller.signal.aborted) setSearchError("Skill search unavailable. Retry or use the current choices."); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search]);
  function toggle(id: string) { const s = filtered.find(s => s.skill_id === id) ?? data.skills.find(s => s.skill_id === id) ?? profile.skills.find(s => s.skill_id === id)!; if ('source_ids' in s) onSkillsLoaded?.([s as Skill]); onChange({ ...profile, skills: profile.skills.some(s => s.skill_id === id) ? profile.skills.filter(s => s.skill_id !== id) : [...profile.skills, { skill_id: id, name: s.name, proficiency: "unknown", self_reported: true }] }); }
  function submit(e: FormEvent) { e.preventDefault(); if (!busy) onSubmit(); }
  return <aside className="profile-panel" id="profile">
    <div className="panel-heading"><span className="step-dot">01</span><div><p className="eyebrow">START WITH YOUR SKILLS</p><h2>Your starting point</h2></div></div>
    <p className="muted small">Explore with a fictional graduate. Edit their skills to see a different path.</p>
    <label htmlFor="persona">Synthetic profile</label><select id="persona" value={profile.profile_id} onChange={e => { const p = data.profiles.find(p => p.profile_id === e.target.value); if (p) onChange(structuredClone(p)); }}>{data.profiles.map((p, i) => <option key={p.profile_id} value={p.profile_id}>{["Graduate A · Data foundations", "Graduate B · Web foundations", "Graduate C · Exploring technology"][i] ?? p.education ?? p.profile_id}</option>)}</select>
    <form onSubmit={submit}>
      <div className="label-row"><label htmlFor="skill-search">Skills & knowledge</label><span className="count">{profile.skills.length} selected</span></div>
      <input id="skill-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Python, SQL, debugging…" autoComplete="off" />
      <div className="skill-picker" aria-label="Available skills">{filtered.map(skill => <button type="button" key={skill.skill_id} aria-pressed={profile.skills.some(s => s.skill_id === skill.skill_id)} onClick={() => toggle(skill.skill_id)} className="skill-option"><span>{skill.name}</span><span aria-hidden="true">{profile.skills.some(s => s.skill_id === skill.skill_id) ? "✓" : "+"}</span></button>)}{!filtered.length && <p className="small muted">No reviewed concept found. Record an unresolved term below.</p>}{searchTotal > 40 && <p className="small muted">Showing 40 of {searchTotal}. Refine your search.</p>}</div>{searchError && <p className="notice small" role="status">{searchError}</p>}
      <details className="selected-skills" open={profile.skills.length < 7}><summary>Selected skills & self-reported levels</summary>{profile.skills.map(skill => <div className="selected-skill" key={skill.skill_id}><span>{skill.name}</span><div><select aria-label={`Level for ${skill.name}`} value={skill.proficiency} onChange={e => onChange({ ...profile, skills: profile.skills.map(s => s.skill_id === skill.skill_id ? { ...s, proficiency: e.target.value as Proficiency } : s) })}>{["unknown", "beginner", "intermediate", "advanced"].map(level => <option key={level}>{level}</option>)}</select><button type="button" className="icon-button" aria-label={`Remove ${skill.name}`} onClick={() => toggle(skill.skill_id)}>×</button></div></div>)}</details>
      <details className="additional-inputs"><summary>Add unresolved skills or interests</summary><label htmlFor="unresolved">Unresolved skills (comma separated)</label><input id="unresolved" value={extra} placeholder="Terms outside this catalogue" onChange={e => { setExtra(e.target.value); onChange({ ...profile, unresolved_skills: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }); }} /><label htmlFor="interests">Interests (comma separated)</label><input id="interests" value={interests} onChange={e => { setInterests(e.target.value); onChange({ ...profile, interests: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }); }} /><p className="small muted">Interests and levels provide context; they do not change relevance scoring.</p></details>
      <div className="form-pair"><div><label htmlFor="weekly-hours">Hours / week</label><input id="weekly-hours" type="number" min="0.1" step="any" value={profile.learning_preferences.hours_per_week ?? ""} onChange={e => onChange({ ...profile, learning_preferences: { ...profile.learning_preferences, hours_per_week: e.target.value ? Number(e.target.value) : null } })} /></div><div><label htmlFor="budget">Budget (MYR)</label><input id="budget" type="number" min="0" step="1" value={profile.learning_preferences.budget?.amount ?? ""} onChange={e => onChange({ ...profile, learning_preferences: { ...profile.learning_preferences, budget: e.target.value ? { amount: Number(e.target.value), currency: "MYR" } : null } })} /></div></div>
      <details className="additional-inputs"><summary>Scheduling convention</summary><label htmlFor="study-days">Planned study days / week</label><input id="study-days" type="number" min="1" max="7" step="1" value={profile.learning_preferences.study_days_per_week ?? 5} onChange={e => onChange({ ...profile, learning_preferences: { ...profile.learning_preferences, study_days_per_week: Number(e.target.value) } })} /><p className="micro">App scheduling assumption. A fallback article uses one study day; a bounded course uses one study week. Published hours remain separate.</p></details>
      <fieldset className="resource-preferences"><legend>Preferred learning formats</legend>{["course", "article", "tutorial", "documentation"].map(kind => <label key={kind}><input type="checkbox" checked={profile.learning_preferences.preferred_resource_types.includes(kind)} onChange={e => onChange({ ...profile, learning_preferences: { ...profile.learning_preferences, preferred_resource_types: e.target.checked ? [...profile.learning_preferences.preferred_resource_types, kind] : profile.learning_preferences.preferred_resource_types.filter(k => k !== kind) } })} />{kind}</label>)}</fieldset>
      <button className="primary full" type="submit" disabled={busy || !profile.skills.length}>{busy ? "Calculating matches…" : "Find matching roles"}<span aria-hidden="true">↗</span></button><p className="micro">Synthetic profiles only. No CV uploads or personal data. Your edits stay in this browser session.</p>
    </form>
  </aside>;
}
