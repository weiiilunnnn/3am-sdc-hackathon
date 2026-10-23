/** Visualises the backend value only; no matching calculations occur here. */
export default function RadialProfileRelevance({ value }: { value: number | null }) {
  const circumference = 2 * Math.PI * 50;
  const label = value === null ? "Unavailable" : `${value.toFixed(2)}%`;
  return <div className="radial-relevance">
    <div className="radial-gauge" role="progressbar" aria-label="Profile relevance, not readiness or hiring probability" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} aria-valuetext={label}>
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle className="radial-track" cx="60" cy="60" r="50" />
        {value !== null && <circle className="radial-fill" cx="60" cy="60" r="50" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} transform="rotate(-90 60 60)" />}
      </svg>
      <div className={`score radial-value${value === null ? " radial-unavailable" : ""}`}><strong>{label}</strong></div>
    </div>
    <p className="radial-label">Profile Relevance</p>
    <p className="micro muted radial-note">Relevance does not indicate career readiness or hiring probability.</p>
  </div>;
}
