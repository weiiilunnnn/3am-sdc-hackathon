import Link from "next/link";

export default function WorkspaceNav({ active, scrolled = false }: { active: "signals" | "explorer"; scrolled?: boolean }) {
  return <header className={`topbar workspace-topbar ${scrolled ? "is-scrolled" : ""}`}>
    <Link className="brand" href="/signals" aria-label="Pathwaay AI trend signals"><span className="brand-mark">P</span> Pathwaay <span className="brand-note">SKILLS WORKSPACE</span></Link>
    <nav className="workspace-nav" aria-label="Skills workspace">
      <Link href="/signals" className={active === "signals" ? "active" : ""} aria-current={active === "signals" ? "page" : undefined}>AI trend signals</Link>
      <Link href="/explorer" className={active === "explorer" ? "active" : ""} aria-current={active === "explorer" ? "page" : undefined}>Career demo</Link>
    </nav>
  </header>;
}
