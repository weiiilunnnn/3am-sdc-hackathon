"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PATHWAAY_PROFILE_HANDOFF_KEY } from "@/lib/pathwaay-profile";

const sections = [
  { href: "/home", label: "My Home" },
  { href: "/profile", label: "My Profile" },
  { href: "/cv-studio", label: "CV Studio" },
  { href: "/outlook", label: "My Skills Outlook" },
  { href: "/explore", label: "Explore Skills" },
  { href: "/radar", label: "Source Evidence" },
  { href: "/explorer", label: "Career Demo" },
];

const employerSections = [
  { href: "/employer", label: "Dashboard" },
  { href: "/employer/directory", label: "Directory" },
  { href: "/employer/profile", label: "Own Profile" },
];

export default function PathwaayRibbon() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 8);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  function logOut() {
    try {
      window.sessionStorage.removeItem(PATHWAAY_PROFILE_HANDOFF_KEY);
      setLogoutError("");
      router.push("/login");
    } catch {
      setLogoutError("Could not end this session. Please try again.");
    }
  }

  if (pathname === "/login" || pathname === "/register") return null;

  const employerArea = pathname === "/employer" || pathname.startsWith("/employer/");
  const navigation = employerArea ? employerSections : sections;

  return (
    <header className={`pathwaay-ribbon${scrolled ? " is-scrolled" : ""}`}>
      <Link className="pathwaay-ribbon-brand" href={employerArea ? "/employer" : "/home"} aria-label={employerArea ? "Employer dashboard" : "Pathwaay home"}>
        <span className="pathwaay-ribbon-mark" aria-hidden="true">P</span>
        <span className="pathwaay-ribbon-name">Pathwaay</span>
        <span className="pathwaay-ribbon-divider" aria-hidden="true" />
        <span className="pathwaay-ribbon-caption">{employerArea ? "EMPLOYER WORKSPACE" : "CAREER EXPLORER"}</span>
      </Link>
      <nav className="pathwaay-ribbon-links" aria-label={employerArea ? "Employer navigation" : "Main navigation"}>
        {navigation.map((item) => {
          const active = pathname === item.href || (item.href !== "/home" && item.href !== "/employer" && pathname.startsWith(`${item.href}/`));
          return <Link key={item.href} href={item.href} className={`pathwaay-ribbon-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>{item.label}</Link>;
        })}
      </nav>
      <div className="pathwaay-ribbon-actions">
        <span className="pathwaay-ribbon-meta"><i aria-hidden="true" /> DEMO EXPERIENCE</span>
        <button className="pathwaay-ribbon-logout" type="button" onClick={logOut}>Log out</button>
        {logoutError && <span className="pathwaay-ribbon-logout-error" role="status">{logoutError}</span>}
      </div>
    </header>
  );
}
