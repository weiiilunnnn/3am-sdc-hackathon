"use client";
import Link from "next/link";
import { careerHref } from "@/lib/future-role-session";
import { useCareerDetail } from "@/lib/use-career-detail";
import FutureRoleShell from "./FutureRoleShell";
import CareerOverview from "./CareerOverview";
import ScenarioNotice from "./ScenarioNotice";
import CareerAnalysisPanels from "./CareerAnalysisPanels";
import { useCareerAnalysis } from "@/lib/career-analysis";

export default function CareerDetails({ id }: { id: string }) {
  const { bootstrap, profile, results, detail, match, error, loading, scoring } = useCareerDetail(id);
  const analysis = useCareerAnalysis(id, profile, !!detail);
  const sources = bootstrap?.sources ?? [];
  const occupationSourceUrl = detail?.role.source_ids.map(id => sources.find(source => source.source_id === id)?.url)
    .find(url => !!url && /^https?:\/\/(?:data\.europa\.eu|ec\.europa\.eu)\//.test(url)) ?? detail?.role.role_id;
  return <FutureRoleShell>
    <Link className="text-button back-to-matches" href="/role-matching" scroll={false}>← Back to Future-Role Matching</Link>
    {loading && <p role="status">Loading verified occupation...</p>}
    {error && <div className="error-panel" role="alert">{error}</div>}
    {profile?.is_synthetic && <p className="micro notice">Synthetic profile: {profile.profile_id}</p>}
    {detail && <>
      <CareerOverview key={detail.role.role_id} role={detail.role} match={match} hasProfile={!!profile} scoring={scoring} sourceUrl={occupationSourceUrl ?? undefined} pathwayHref={`${careerHref(id)}/pathway`} />
      <CareerAnalysisPanels analysis={analysis.data} busy={analysis.busy} error={analysis.error} hasProfile={!!profile} retryable={analysis.retryable} retrying={analysis.retrying} onRetry={analysis.retry} occupationSourceUrl={occupationSourceUrl ?? undefined} />
      {results?.scenario_context && <ScenarioNotice context={results.scenario_context} sources={sources} />}
    </>}
  </FutureRoleShell>;
}
