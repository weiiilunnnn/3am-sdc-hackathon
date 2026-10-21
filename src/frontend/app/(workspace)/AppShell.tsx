"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/home" aria-label="Aiversecity home">
          <span className="brand-mark" aria-hidden="true">AV</span>
          <span>Aiversecity<small>3AM SDC · FUTURE-READY WORKFORCE</small></span>
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          {sections.map((item) => (
            <Link key={item.href} href={item.href} className={`nav-link ${pathname === item.href ? "active" : ""}`} aria-current={pathname === item.href ? "page" : undefined} data-testid={`link-${item.href === "/profile" ? "profile" : item.href.slice(1)}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="nav-meta">DEMO WORKSPACE</span>
      </header>
      {children}
      <footer className="footer-note">AIVERSECITY · A PRACTICAL WORKSPACE FOR WHAT COMES NEXT</footer>
    </div>
  );
}
