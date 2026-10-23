"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FutureRoleShell from "@/components/FutureRoleShell";
import { displayOccupationTitle, displaySkillLabel } from "@/lib/career-display";
import { request } from "@/lib/future-role-api";
import { careerHref, initialiseRoleProfile, useFutureRoleSession } from "@/lib/future-role-session";

type RoleDetail = { role: { role_id: string; title: string; description: string } };
type SDGTarget = { code: string; title: string; definition: string };
type RankedSDG = {
  number: string;
  title: string;
  summary: string;
  icon_url: string;
  relative_fit: number;
  mapped_skill_count: number;
  targets: SDGTarget[];
};
type SDGRecommendation = {
  role: string;
  mapping_basis: "role" | "profile_skills";
  ranked_sdgs: RankedSDG[];
  skill_mappings: Array<{ name: string; goals: string[] }>;
  data_notice: string;
};

export default function RoleSdgExplorer() {
  const session = useFutureRoleSession();
  const [roleId, setRoleId] = useState("");
  const [role, setRole] = useState<RoleDetail["role"] | null>(null);
  const [recommendation, setRecommendation] = useState<SDGRecommendation | null>(null);
  const [selectedGoal, setSelectedGoal] = useState("");
  const [selectedTarget, setSelectedTarget] = useState<SDGTarget | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [error, setError] = useState("");
  const [goalError, setGoalError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const id = new URLSearchParams(window.location.search).get("role_id")?.trim() ?? "";
    setRoleId(id);
    if (!id) {
      setError("Open Explore SDG from a career detail to see that occupation here.");
      setLoadingRole(false);
      return () => controller.abort();
    }
    void (async () => {
      try {
        await initialiseRoleProfile();
        const result = await request<RoleDetail>(`/api/v2/roles/detail?role_id=${encodeURIComponent(id)}`, undefined, controller.signal);
        if (result.role.role_id !== id) throw new Error("The returned occupation does not match this link.");
        if (!controller.signal.aborted) setRole(result.role);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Career details are unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoadingRole(false);
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!role) return;
    const controller = new AbortController();
    setRecommendation(null);
    setSelectedGoal("");
    setSelectedTarget(null);
    setGoalError("");
    setLoadingGoals(true);
    void request<SDGRecommendation>("/api/sdg/recommendations", {
      role: role.title,
      skills: session.profile?.skills.map((skill) => skill.name) ?? [],
    }, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setRecommendation(result);
        setSelectedGoal(result.ranked_sdgs[0]?.number ?? "");
      }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setGoalError(cause instanceof Error ? cause.message : "SDG mappings are unavailable.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingGoals(false);
    });
    return () => controller.abort();
  }, [role, session.profile]);

  const profile = session.profile;
  const mappedSkills = new Set(recommendation?.skill_mappings.map((skill) => skill.name.trim().toLowerCase()) ?? []);
  const currentGoal = recommendation?.ranked_sdgs.find((goal) => goal.number === selectedGoal);

  return <FutureRoleShell>
    <div className="role-sdg-page">
      {role && <Link className="text-button back-to-matches" href={careerHref(roleId)}>← Back to Career Details</Link>}
      {loadingRole && <p role="status">Loading the selected career and your profile...</p>}
      {error && <div className="error-panel compact" role="alert">{error}</div>}
      {role && <>
        <section className="career-overview role-sdg-career" aria-labelledby="role-sdg-career-title">
          <p className="eyebrow">01 / CAREER IN FOCUS</p>
          <h1 id="role-sdg-career-title">{displayOccupationTitle(role.title)}</h1>
          <p>{role.description}</p>
          <div className="role-sdg-skills">
            <h2>Your current skills</h2>
            {!profile?.skills.length
              ? <p className="small muted">No saved skills are available in your Role Matching profile yet.</p>
              : <ul aria-label="Current profile skills">{profile.skills.map((skill) =>
                <li key={skill.skill_id} className={mappedSkills.has(skill.name.trim().toLowerCase()) ? "is-sdg-mapped" : ""}>
                  {displaySkillLabel(skill.name)}<span>{mappedSkills.has(skill.name.trim().toLowerCase()) ? "Mapped in this dataset" : "No exact SDG skill mapping"}</span>
                </li>)}</ul>}
          </div>
        </section>

        <section className="role-sdg-section" id="sdg-mapping" aria-labelledby="role-sdg-heading">
          <div className="role-sdg-section-heading">
            <div><p className="eyebrow">02 / PURPOSE IN PRACTICE</p><h2 id="role-sdg-heading">Explore SDG connections</h2></div>
            <span className="small-label">THE 2030 AGENDA</span>
          </div>
          {loadingGoals && <p role="status">Checking the available synthetic SDG mappings...</p>}
          {goalError && <div className="error-panel compact" role="alert">{goalError}</div>}
          {recommendation && <>
            <p className="small muted">{recommendation.mapping_basis === "role"
              ? "These links use the role-specific rows available in the synthetic mapping dataset."
              : "No role-specific mapping exists for this occupation. These links are based only on exact matches to your current skills in the synthetic dataset."}</p>
            <div className="role-sdg-goals">
              {recommendation.ranked_sdgs.map((goal) => <button
                type="button"
                key={goal.number}
                className={`role-sdg-goal${selectedGoal === goal.number ? " selected" : ""}`}
                aria-pressed={selectedGoal === goal.number}
                onClick={() => { setSelectedGoal(goal.number); setSelectedTarget(null); }}
              >
                <img src={goal.icon_url} alt={`Sustainable Development Goal ${goal.number}: ${goal.title}`} />
                <span className="role-sdg-goal-copy"><strong>SDG {goal.number} · {goal.title}</strong><span>{goal.summary}</span><small>{goal.mapped_skill_count} mapped skills · Relative fit {goal.relative_fit}%</small></span>
              </button>)}
            </div>
            <p className="micro muted">{recommendation.data_notice}</p>
            {currentGoal && <div className="role-sdg-targets">
              <h3>Targets for SDG {currentGoal.number}</h3>
              <div className="role-sdg-target-list">
                {currentGoal.targets.map((target) => <button type="button" key={target.code}
                  aria-pressed={selectedTarget?.code === target.code}
                  className={selectedTarget?.code === target.code ? "selected" : ""}
                  onClick={() => setSelectedTarget(target)}
                ><strong>{target.code}</strong><span>{target.title}</span></button>)}
              </div>
              {selectedTarget && <article className="role-sdg-target-detail" aria-live="polite">
                <span className="small-label">TARGET {selectedTarget.code}</span>
                <h4>{selectedTarget.title}</h4>
                <p>{selectedTarget.definition}</p>
              </article>}
            </div>}
            <p className="role-sdg-attribution">Official SDG icons from the <a href="https://sdgs.un.org/goals" target="_blank" rel="noreferrer">United Nations</a>. The content of this publication has not been approved by the United Nations and does not reflect the views of the United Nations or its officials or Member States.</p>
          </>}
        </section>
      </>}
    </div>
  </FutureRoleShell>;
}
