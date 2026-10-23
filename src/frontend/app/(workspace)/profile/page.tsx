"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import CompletedProfile from "./CompletedProfile";
import { PATHWAAY_PROFILE_HANDOFF_KEY, readPathwaayRegistrationProfile, type PathwaayRegistrationProfile } from "@/lib/pathwaay-profile";

export default function ProfilePage() {
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
      throw new Error("Your changes could not be saved in this browser session. Remove the photo or try again.");
    }
  }, []);

  if (!loaded) {
    return <main className="page-wrap"><div className="message info" role="status">Opening your completed profile…</div></main>;
  }

  if (!profile) {
    return <main className="page-wrap"><section className="panel state-panel empty-state">
      <span className="empty-mark" aria-hidden="true">01</span>
      <h1>Complete registration to view your profile.</h1>
      <p>Your completed Pathwaay profile appears here after you finish the registration journey.</p>
      <Link className="button" href="/register">Go to registration <span aria-hidden="true">→</span></Link>
    </section></main>;
  }

  return <CompletedProfile profile={profile} onProfileChange={saveProfile} />;
}
