"use client";

import Link from "next/link";

export function ProfileGate({ loading, error, onRetry }: { loading: boolean; error: string; onRetry: () => void }) {
  if (loading) return <div className="panel state-panel"><div className="skeleton" aria-label="Loading saved profile" /><p role="status">Checking this device for a saved fictional profile…</p></div>;
  if (error) return <div className="panel state-panel"><p className="message error" role="alert">{error}</p><button className="button secondary" onClick={onRetry} type="button">Try again</button></div>;
  return <div className="panel state-panel empty-state"><span className="empty-mark" aria-hidden="true">01</span><h2>Your workspace starts with a profile.</h2><p>Complete the fictional registration journey to create your Pathwaay profile.</p><Link className="button" href="/register">Go to registration <span aria-hidden="true">→</span></Link></div>;
}

export function PageIntro({ kicker, title, description, index }: { kicker: string; title: React.ReactNode; description: string; index: string }) {
  return <><div className="page-kicker"><span className="kicker-dot" /> {kicker}</div><div className="hero-row"><div><h1>{title}</h1><p className="hero-copy">{description}</p></div><span className="hero-index">{index}</span></div></>;
}

export function FormatDate({ value }: { value: string }) {
  const date = new Date(value);
  return <>{Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { dateStyle: "medium" })}</>;
}
