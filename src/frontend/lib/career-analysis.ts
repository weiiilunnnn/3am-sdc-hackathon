"use client";
import { useEffect, useState } from "react";
import type { Profile, Requirement } from "./contracts";
import { request } from "./future-role-api";

export type CapabilityGroup = { group_id: string; concept_uri: string; title: string; count: number; mapping_method: string; concepts: Requirement[]; explanation: string };
export type CareerAnalysis = {
  role_id: string; evidence_key: string; status: "ready" | "partial" | "unavailable"; message: string;
  groups: CapabilityGroup[]; matched: Requirement[]; not_evidenced_count: number; grouping_warning: string | null;
  interpretations: { group_id: string; why_relevant: string; evidence_ids: string[] }[];
  bridges: { matched_skill_ids: string[]; target_group_id: string; explanation: string; evidence_ids: string[] }[];
  evidence: { evidence_id: string; title: string; text: string; url: string }[]; used_cache: boolean;
};
const pending = new Map<string, Promise<CareerAnalysis>>();
function load(roleId: string, ids: string[], generateAi: boolean) {
  const key = JSON.stringify([roleId, ids, generateAi]);
  let promise = pending.get(key);
  if (!promise) {
    promise = request<CareerAnalysis>("/api/v2/roles/analysis", { role_id: roleId, recognised_skill_ids: ids, generate_ai: generateAi })
      .finally(() => pending.delete(key));
    pending.set(key, promise);
  }
  return promise;
}

export function useCareerAnalysis(roleId: string, profile: Profile | null, enabled: boolean) {
  const signature = profile ? JSON.stringify([...new Set(profile.skills.map(s => s.skill_id))].sort()) : "";
  const identity = JSON.stringify([roleId, signature, enabled]);
  const [state, setState] = useState<{ identity: string; data: CareerAnalysis | null; busy: boolean; error: string }>({ identity: "", data: null, busy: false, error: "" });
  useEffect(() => {
    let active = true;
    setState({ identity, data: null, busy: enabled && !!signature, error: "" });
    if (enabled && signature) void (async () => {
      try {
        const ids = JSON.parse(signature) as string[];
        const evidence = await load(roleId, ids, false);
        if (!active) return;
        setState({ identity, data: evidence, busy: evidence.groups.length > 0, error: "" });
        if (!evidence.groups.length) return;
        const interpreted = await load(roleId, ids, true);
        if (active && interpreted.evidence_key === evidence.evidence_key && interpreted.role_id === roleId)
          setState({ identity, data: interpreted, busy: false, error: "" });
      } catch {
        if (active) setState(s => ({ ...s, busy: false, error: "AI analysis unavailable. Existing ESCO evidence remains available." }));
      } finally {
        if (active) setState(s => ({ ...s, busy: false }));
      }
    })();
    return () => { active = false; };
  }, [roleId, signature, enabled, identity]);
  return state.identity === identity ? state : { data: null, busy: false, error: "" };
}
