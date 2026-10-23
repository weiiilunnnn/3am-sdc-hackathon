"use client";
import { useEffect, useState } from "react";
import { request } from "./future-role-api";
import { cachedRole, initialiseRoleProfile, loadRoleScore, mergeRoleReference, useFutureRoleSession, type RoleDetail, type RoleResult } from "./future-role-session";

export function useCareerDetail(id: string) {
  const session = useFutureRoleSession();
  const [detail, setDetail] = useState<RoleDetail | null>(null);
  const [match, setMatch] = useState<RoleResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setDetail(null);
    void (async () => {
      try {
        await initialiseRoleProfile();
        const result = await request<RoleDetail>(`/api/v2/roles/detail?role_id=${encodeURIComponent(id)}`, undefined, controller.signal);
        if (result.role.role_id !== id) throw new Error("The returned occupation does not match this link.");
        if (!controller.signal.aborted) { mergeRoleReference(result.skills, result.sources); setDetail(result); }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Occupation unavailable."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [id]);
  useEffect(() => {
    const controller = new AbortController(); setMatch(null);
    if (detail && session.profile) {
      setScoring(true);
      const cached = cachedRole(id); if (cached) { setMatch(cached); setScoring(false); }
      else void loadRoleScore(detail, session.profile, controller.signal).then(result => { if (!controller.signal.aborted) setMatch(result); }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Score unavailable."); }).finally(() => { if (!controller.signal.aborted) setScoring(false); });
    } else setScoring(false);
    return () => controller.abort();
  }, [detail, session.profile, id]);
  return { ...session, detail, match, error, loading, scoring };
}
