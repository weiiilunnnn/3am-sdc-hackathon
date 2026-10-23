export default function ProfileRelevance({ value }: { value: number | null }) {
  return <div className="relevance-summary">
    <div className="score"><strong>{value === null ? "Unavailable" : `${value.toFixed(2)}%`}</strong><span>Profile relevance</span></div>
    <div className="coverage-track" role="progressbar" aria-label="Profile relevance, not readiness or hiring probability" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} aria-valuetext={value === null ? "Unavailable" : `${value.toFixed(2)}%`}><span style={{ width: `${value ?? 0}%` }} /></div>
  </div>;
}
