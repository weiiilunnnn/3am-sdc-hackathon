"use client";
import { useEffect, useRef, useState } from "react";
import type { Profile, Requirement } from "./contracts";
import { request } from "./future-role-api";
import { awaitCareerAnalysis, type AnalysisJob } from "./career-analysis-job";

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
  const session = useRef<{ identity: string; controller: AbortController; locked: boolean } | null>(null);
  const [jobState, setJobState] = useState<{ identity: string; job: AnalysisJob | null; retrying: boolean }>({ identity: "", job: null, retrying: false });
  const [state, setState] = useState<{ identity: string; data: CareerAnalysis | null; busy: boolean; error: string }>({ identity: "", data: null, busy: false, error: "" });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    session.current = { identity, controller, locked: false };
    setJobState({ identity, job: null, retrying: false });
    setState({ identity, data: null, busy: enabled && !!signature, error: "" });
    if (enabled && signature) void (async () => {
      try {
        const ids = JSON.parse(signature) as string[];
        const evidence = await load(roleId, ids, false);
        if (!active) return;
        setState({ identity, data: evidence, busy: evidence.groups.length > 0, error: "" });
        if (!evidence.groups.length) return;
        const interpreted = await awaitCareerAnalysis({role_id: roleId, recognised_skill_ids: ids},
          evidence.evidence_key, controller.signal, (path, payload, signal) => request(path, payload, signal), undefined, undefined,
          { onJob: job => { if (active) setJobState({ identity, job, retrying: false }); } });
        if (active) setState({ identity, data: interpreted ?? evidence, busy: false,
          error: interpreted ? "" : "AI analysis unavailable. Existing ESCO evidence remains available." });
      } catch {
        if (active) setState(s => ({ ...s, busy: false, error: "AI analysis unavailable. Existing ESCO evidence remains available." }));
      } finally {
        if (active) setState(s => ({ ...s, busy: false }));
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [roleId, signature, enabled, identity]);
  const current = state.identity === identity ? state : { data: null, busy: false, error: "" };
  const job = jobState.identity === identity ? jobState.job : null;
  const retrying = jobState.identity === identity && jobState.retrying;
  const retryable = !!(enabled && profile && current.data?.groups.length && current.data.matched.length && !current.busy &&
    job?.job_id && job.evidence_key === current.data.evidence_key && job.retryable && ["failed", "expired"].includes(job.status));
  async function retry() {
    const run = session.current;
    if (!retryable || !job?.job_id || !current.data || !run || run.identity !== identity || run.controller.signal.aborted || run.locked) return;
    run.locked = true; // Synchronous guard: a second click cannot race React's render.
    setJobState({ identity, job, retrying: true });
    setState(s => ({ ...s, busy: true, error: "" }));
    const active = () => session.current === run && !run.controller.signal.aborted;
    try {
      const interpreted = await awaitCareerAnalysis({ role_id: roleId, recognised_skill_ids: JSON.parse(signature) },
        current.data.evidence_key, run.controller.signal, (path, payload, signal) => request(path, payload, signal), undefined, undefined,
        { retryJobId: job.job_id, onJob: next => { if (active()) setJobState({ identity, job: next, retrying: true }); } });
      if (active()) setState(s => ({ ...s, data: interpreted ?? s.data, busy: false,
        error: interpreted ? "" : "AI analysis unavailable. Existing ESCO evidence remains available." }));
    } catch {
      if (active()) {
        // The submission may have reached the server. Recover by reopening the page;
        // never offer another submission based on an uncertain old ticket.
        setJobState({ identity, job: null, retrying: false });
        setState(s => ({ ...s, busy: false, error: "AI connection interrupted. Reopen this page to check the existing job. ESCO evidence remains available." }));
      }
    } finally {
      run.locked = false;
      if (active()) setJobState(s => ({ ...s, retrying: false }));
    }
  }
  return { ...current, job, retryable, retrying, retry };
}
