/** Small native SVG set; label matching selects decoration, never a skill taxonomy. */
export type CareerIconKind = "target" | "bridge" | "grid" | "chart" | "brain" | "database" | "cloud" | "collection" | "generic" | "chevron" | "info" | "plus" | "occupation" | "globe";
export function capabilityIcon(label: string): CareerIconKind {
  if (/artificial intelligence|machine learning|neural|\bai\b/i.test(label)) return "brain";
  if (/database|\bsql\b|query language/i.test(label)) return "database";
  if (/cloud|hosting|\bsaas\b/i.test(label)) return "cloud";
  if (/collect|record|document/i.test(label)) return "collection";
  if (/analy|statistic|calculat|visuali|data/i.test(label)) return "chart";
  return "generic";
}
export default function CareerAnalysisIcon({ kind }: { kind: CareerIconKind }) {
  const paths = {
    occupation: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V3h8v4M3 12c6 4 12 4 18 0M10 14h4" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="m12 12 8-8m-4 0h4v4" /></>,
    bridge: <><path d="M3 7h17m-5-5 5 5-5 5M21 17H4m5-5-5 5 5 5" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    chart: <path d="M5 21v-6m7 6V9m7 12V3" />,
    brain: <><path d="M12 4c-4-4-8 0-7 3-4 1-4 6-1 7-2 4 2 8 5 6 1 3 3 2 3 0V4Zm0 0c4-4 8 0 7 3 4 1 4 6 1 7 2 4-2 8-5 6-1 3-3 2-3 0" /><path d="m8 7 1 3-3 2m10-5-1 3 3 2M7 17l2-2m8 2-2-2" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" /></>,
    cloud: <path d="M6 19a5 5 0 0 1-1-10 7 7 0 0 1 13-2 6 6 0 0 1 0 12H6Z" />,
    collection: <><path d="M5 2h10l5 5v15H5ZM14 2v6h6M9 12h7m-7 4h7m-7 3h3" /></>,
    generic: <><path d="m12 2 2 4 4-1 1 4 3 3-3 3-1 4-4-1-2 4-2-4-4 1-1-4-3-3 3-3 1-4 4 1Z" /><circle cx="12" cy="12" r="3" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></>,
    plus: <path d="M12 4v16M4 12h16" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[kind]}</svg>;
}
