import type { Resource } from "@/lib/contracts";
import { checkedDate, moneyLabel, resourceTiming, supportedText } from "@/lib/pathway-presentation";
import PathwayIcon, { resourceAppearance } from "./PathwayIcon";

export default function PathwayResourceCard({ resource: r, earlierTitles }: { resource: Resource; earlierTitles: string[] }) {
  const verified = r.evidence_status === "verified";
  const appearance = resourceAppearance(verified ? r.resource_type : undefined);
  const provider = verified && supportedText(r.provider);
  const cost = verified ? r.cost_status === "free" ? "FREE CONTENT" : r.cost_status !== "unknown" ? moneyLabel(r.cost) : null : null;
  const time = resourceTiming(r);
  const date = checkedDate(r.content_verified_at) ?? checkedDate(r.access_verified_at);
  const origin = r.resource_origin === "web_discovered" ? r.retrieval_mode === "cached_verified" ? "Previously discovered" : "Discovered online" : r.resource_origin === "local_catalogue" ? "Reviewed catalogue" : null;
  const prerequisites = verified && ["provider_stated", "reviewed", "reviewed_catalogue"].includes(r.prerequisite_status ?? "") ? supportedText(r.prerequisite_notes) : null;
  return <section className="resource-card pathway-resource" data-resource-icon={appearance.icon}>
    <span className="pathway-resource-icon"><PathwayIcon kind={appearance.icon} /></span>
    <div className="pathway-resource-body">
      <div className="label-row">{(provider || appearance.label) && <span className="mini-heading">{[provider, appearance.label].filter(Boolean).join(" · ")}</span>}{cost && <span className="badge">{cost}</span>}</div>
      <h4><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title} ↗</a></h4>
      {(origin || date) && <p className="micro muted" data-testid="resource-origin">{[origin, date ? `Provider details checked ${date}` : null].filter(Boolean).join(" · ")}</p>}
      {time && <p className="resource-duration"><PathwayIcon kind="clock" />{time}</p>}
      {earlierTitles.length > 0 && <p className="prerequisite-hint micro">Earlier learning: {earlierTitles.join(", ")}</p>}
      {prerequisites && <p className="prerequisite-hint micro">Prerequisites: {prerequisites}</p>}

    </div>
  </section>;
}
