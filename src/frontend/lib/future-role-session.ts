"use client";
import { useSyncExternalStore } from "react";
import type { Bootstrap, DiscoveryResponse, DiscoveryRole, Profile, RoleSearchResponse, RoleSearchResult, Source } from "./contracts";
import { request } from "./future-role-api";
import { PROFILE_KEY } from "../app/(workspace)/profile-workspace";

export type RoleResult = DiscoveryRole | RoleSearchResult;
export type RoleResults = DiscoveryResponse | RoleSearchResponse;
export type RoleDetail = { role: { role_id: string; title: string; description: string; source_ids: string[] }; skills: Bootstrap["skills"]; sources: Source[] };
type Session = { profile: Profile | null; bootstrap: Bootstrap | null; results: RoleResults | null; recommendations: DiscoveryResponse | null; query: string; scrollY: number };
const initial: Session = { profile: null, bootstrap: null, results: null, recommendations: null, query: "", scrollY: 0 };
let session = initial;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useFutureRoleSession() { return useSyncExternalStore(subscribe, () => session, () => initial); }
export function updateRoleSession(patch: Partial<Session>) { session = { ...session, ...patch }; listeners.forEach(listener => listener()); }

/** Optional direct intake handoff; saved workspace profiles load on entry too. */
export function setCurrentFutureRoleProfile(profile: Profile | null) {
  updateRoleSession({ profile, results: null, recommendations: null, query: "", scrollY: 0 });
}
let referencePromise: Promise<Bootstrap> | null = null;
export async function loadRoleReference(): Promise<Bootstrap> {
  if (session.bootstrap) return session.bootstrap;
  if (!referencePromise) referencePromise = request<Bootstrap>("/api/v2/bootstrap").then(data => {
    updateRoleSession({ bootstrap: data }); return data;
  }).finally(() => { referencePromise = null; });
  return referencePromise;
}
export function mergeRoleReference(skills: Bootstrap["skills"], sources: Source[]) {
  const data = session.bootstrap;
  if (data) updateRoleSession({ bootstrap: { ...data,
    skills: [...new Map([...data.skills, ...skills].map(s => [s.skill_id, s])).values()],
    sources: [...new Map([...data.sources, ...sources].map(s => [s.source_id, s])).values()],
  } });
}
let savedProfileSignature: string | null = null;
export async function initialiseRoleProfile() {
  const data = await loadRoleReference();
  // Explicit development/test fixture ID only; never put skills in the URL.
  if (process.env.NODE_ENV !== "production") {
    const id = new URLSearchParams(window.location.search).get("demo");
    if (id && session.profile?.profile_id !== id) {
      const fixture = data.profiles.find(p => p.profile_id === id);
      if (!fixture) throw new Error("Unknown synthetic demo profile.");
      setCurrentFutureRoleProfile(fixture);
    }
    if (id) return data;
  }
  try {
    const id = window.localStorage.getItem(PROFILE_KEY);
    if (id) {
      const profile = await request<Profile>(`/api/v2/profiles/${encodeURIComponent(id)}`);
      const signature = JSON.stringify(profile);
      if (signature !== savedProfileSignature || JSON.stringify(session.profile) !== signature) {
        setCurrentFutureRoleProfile(profile);
        savedProfileSignature = signature;
      }
    } else if (savedProfileSignature !== null) {
      setCurrentFutureRoleProfile(null);
      savedProfileSignature = null;
    }
  } catch (error) {
    setCurrentFutureRoleProfile(null);
    savedProfileSignature = null;
    throw new Error(`Could not load your saved profile. ${error instanceof Error ? error.message : "Try again or open Profile."}`);
  }
  return data;
}
export function careerHref(id: string) { return `/role-matching/roles/${encodeURIComponent(id)}`; }
export function decodeRoleParam(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}
export function cachedRole(id: string) { return session.results?.results.find(r => r.role_id === id); }

/** Deep links reuse backend scoring; no score arithmetic runs in React. */
export async function loadRoleScore(detail: RoleDetail, profile: Profile, signal: AbortSignal): Promise<RoleResult> {
  const cached = cachedRole(detail.role.role_id);
  if (cached) return cached;
  let offset: number | null = 0;
  while (offset !== null) {
    const response: RoleSearchResponse = await request("/api/v2.1/roles/search", {
      schema_version: "2.1", profile, role_query: detail.role.title.slice(0, 100), page_size: 25, offset,
    }, signal);
    mergeRoleReference([], response.sources);
    const found = response.results.find(r => r.role_id === detail.role.role_id);
    if (found) return found;
    offset = response.next_offset;
  }
  throw new Error("A backend score is not available for this occupation.");
}
