"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { restoreHybridProfile, saveHybridProfile } from "@/lib/hybrid-profile";
import CompletedProfile from "../CompletedProfile";
import { PATHWAAY_PROFILE_HANDOFF_KEY, readPathwaayRegistrationProfile, type PathwaayRegistrationProfile } from "@/lib/pathwaay-profile";

export default function EditCompletedProfilePage() {
  const [profile, setProfile] = useState<PathwaayRegistrationProfile | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void restoreHybridProfile().then(p => { if (active) setProfile(p); }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Saved profile unavailable."); }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const saveProfile = useCallback(async (next: PathwaayRegistrationProfile) => {
    const saved = await saveHybridProfile(next);
    setProfile(saved);
    window.dispatchEvent(new CustomEvent("pathwaay-profile-updated", { detail: saved }));
  }, []);

  if (!loaded) return <main className="page-wrap"><section className="panel state-panel"><div className="skeleton" aria-label="Loading profile" /></section></main>;
  if (error) return <main className="page-wrap"><p role="alert">{error} Reload to retry. Your profile reference has been retained.</p></main>;
  if (!profile) return <main className="page-wrap"><section className="panel state-panel empty-state"><div className="completed-section-kicker">PROFILE NOT AVAILABLE</div><h1>There’s no session profile to edit.</h1><p>Start the registration journey to create a profile, then you can edit it here.</p><Link className="button" href="/register">Go to registration <span aria-hidden="true">→</span></Link></section></main>;

  return <CompletedProfile profile={profile} onProfileChange={saveProfile} editPage />;
}
