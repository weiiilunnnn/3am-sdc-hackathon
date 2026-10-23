import type { Source } from "@/lib/contracts";
export default function SourceLinks({ ids, sources, label = "View sources" }: { ids: string[]; sources: Source[]; label?: string }) {
  return <details className="sources"><summary>{label} ↗</summary><ul>{[...new Set(ids)].map(id => {
    const s = sources.find(s => s.source_id === id);
    return <li key={id}>{s ? <>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a> : <strong>{s.title}</strong>}<small>{s.publisher} · {s.evidence_status}{s.accessed_at ? ` · Checked ${s.accessed_at}` : ""}{s.dataset_version ? ` · ${s.dataset_version}` : ""}</small>{s.native_record_id && <small className="record-id">Record: {s.native_record_id}</small>}{s.url && <small className="record-id">{s.url}</small>}</> : <span>Evidence unavailable for {id}</span>}</li>;
  })}</ul></details>;
}
