"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/", label: "Skills profile", available: true },
  { href: "/radar", label: "Skills radar", available: true },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Aiversecity home">
          <span className="brand-mark" aria-hidden="true">AV</span>
          <span>Aiversecity<small>3AM SDC · FUTURE-READY WORKFORCE</small></span>
        </Link>
        <nav className="nav-links" aria-label="Main navigation">
          {sections.map((item) => (
            <Link key={item.href} href={item.href} className={`nav-link ${pathname === item.href ? "active" : ""}`} aria-current={pathname === item.href ? "page" : undefined} data-testid={`link-${item.href === "/" ? "profile" : "radar"}`}>
              {item.label}
            </Link>
          ))}
          {["Role pathways", "Learning plans", "SDG impact", "Workforce outlook"].map((label, index) => (
            <span className="nav-link unavailable" key={label} title="Feature not available in this version" aria-disabled="true" data-testid={`feature-unavailable-${index + 3}`}>{label}</span>
          ))}
        </nav>
        <span className="nav-meta">DEMO WORKSPACE</span>
      </header>
      {children}
      <footer className="footer-note">AIVERSECITY · A PRACTICAL WORKSPACE FOR WHAT COMES NEXT</footer>
    </div>
  );
}
