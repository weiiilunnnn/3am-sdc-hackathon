"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const sections = [
  { href: "/home", label: "My Home" },
  { href: "/profile", label: "My Profile" },
  { href: "/cv-studio", label: "CV Studio" },
  { href: "/outlook", label: "My Skills Outlook" },
  { href: "/explore", label: "Explore Skills" },
  { href: "/radar", label: "Source Evidence" },
  { href: "/explorer", label: "Career Demo" },
  { href: "/role-matching", label: "Role Matching" },
];

export default function PathwaayRibbon() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 8);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

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
      <span className="pathwaay-ribbon-meta"><i aria-hidden="true" /> DEMO EXPERIENCE</span>
    </header>
  );
}
