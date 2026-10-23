"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PATHWAAY_PROFILE_HANDOFF_KEY } from "@/lib/pathwaay-profile";

const sections = [
  { href: "/home", label: "My Home" },
  { href: "/profile", label: "My Profile" },
  { href: "/cv-studio", label: "CV Studio" },

  { href: "/signals", label: "AI Trend Signal" },
  { href: "/role-matching", label: "Role Matching" },
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

  return (
    <header className={`pathwaay-ribbon${scrolled ? " is-scrolled" : ""}`}>
      <Link className="pathwaay-ribbon-brand" href="/home" aria-label="Pathwaay home">
        <span className="pathwaay-ribbon-mark" aria-hidden="true">P</span>
        <span className="pathwaay-ribbon-name">Pathwaay</span>
        <span className="pathwaay-ribbon-divider" aria-hidden="true" />
        <span className="pathwaay-ribbon-caption">CAREER EXPLORER</span>
      </Link>
      <nav className="pathwaay-ribbon-links" aria-label="Main navigation">
        {sections.map((item) => {
          const active = pathname === item.href || (item.href !== "/home" && pathname.startsWith(`${item.href}/`));
          return <Link key={item.href} href={item.href} className={`pathwaay-ribbon-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined} data-testid={`link-${item.href === "/profile" ? "profile" : item.href.slice(1)}`}>{item.label}</Link>;
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
