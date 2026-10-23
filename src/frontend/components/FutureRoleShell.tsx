import type { ReactNode } from "react";

export default function FutureRoleShell({ children }: { children: ReactNode }) {
  return <main className="app-main role-pages">{children}
    <p className="micro muted role-reference-note">Occupational reference: European Commission ESCO.<br />Profile relevance is not readiness or hiring probability. No European Commission endorsement implied.</p>
  </main>;
}
