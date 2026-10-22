"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import CompletedProfile from "../CompletedProfile";
import { PATHWAAY_PROFILE_HANDOFF_KEY, readPathwaayRegistrationProfile, type PathwaayRegistrationProfile } from "@/lib/pathwaay-profile";

export default function EditCompletedProfilePage() {
  const [profile, setProfile] = useState<PathwaayRegistrationProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setProfile(readPathwaayRegistrationProfile());
    setLoaded(true);
  }, []);

  const saveProfile = useCallback((next: PathwaayRegistrationProfile) => {
    try {
      window.sessionStorage.setItem(PATHWAAY_PROFILE_HANDOFF_KEY, JSON.stringify(next));
      setProfile(next);
      window.dispatchEvent(new CustomEvent("pathwaay-profile-updated", { detail: next }));
    } catch {
      const message = "Your changes could not be saved in this browser session. Remove the photo or try again.";
      throw new Error(message);
    }
  }, []);

  if (!loaded) return <main className="page-wrap"><section className="panel state-panel"><div className="skeleton" aria-label="Loading profile" /></section></main>;
  if (!profile) return <main className="page-wrap"><section className="panel state-panel empty-state"><div className="completed-section-kicker">PROFILE NOT AVAILABLE</div><h1>There’s no session profile to edit.</h1><p>Start the registration journey to create a profile, then you can edit it here.</p><Link className="button" href="/register">Go to registration <span aria-hidden="true">→</span></Link></section></main>;

  return <CompletedProfile profile={profile} onProfileChange={saveProfile} editPage />;
}
