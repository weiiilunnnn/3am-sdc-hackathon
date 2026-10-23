import type { ScenarioContext, Source } from "@/lib/contracts";
import SourceLinks from "./SourceLinks";
export default function ScenarioNotice({ context, sources }: { context: ScenarioContext; sources: Source[] }) {
  return <section className="method-panel" aria-label="Hypothetical scenario context">
    <p className="eyebrow" style={{ marginTop: 14 }}>HYPOTHETICAL SCENARIO · {context.is_synthetic ? "SYNTHETIC" : "OWNER-SUPPLIED ASSUMPTIONS"}</p><h3>{context.display_label}</h3><p className="small">{context.disclaimer}</p>
    <p className="small muted">Method: {context.model_method} · Version: {context.version}. Personal-fit scores and observed signals remain unchanged; no numerical scenario transformation is applied.</p>
    {context.assumptions.map((a, i) => <p className="small muted" key={i}>{a}</p>)}<SourceLinks ids={context.source_ids} sources={sources} label="Scenario method evidence" />
  </section>;
}
