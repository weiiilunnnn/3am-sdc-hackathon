"use client";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <div className="ambient-layer" aria-hidden="true" />
      {children}
      <footer className="footer-note">PATHWAAY · CAREER EXPLORER</footer>
    </div>
  );
}
