"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Pathway } from "@/lib/contracts";
import { request } from "@/lib/future-role-api";
import { careerHref, decodeRoleParam } from "@/lib/future-role-session";
import { useCareerDetail } from "@/lib/use-career-detail";
import FutureRoleShell from "@/components/FutureRoleShell";
import PathwayView from "@/components/PathwayView";

export default function CareerPathwayPage() {
  const { roleId: routeParam } = useParams<{ roleId: string }>();
  const roleId = decodeRoleParam(routeParam);
  const { profile, bootstrap, detail, match, results, error, loading, scoring } = useCareerDetail(roleId);
  const [pathway, setPathway] = useState<Pathway | null>(null);
  const [pathError, setPathError] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setPathway(null); setPathError("");
    if (profile && detail && match?.pathway_available) void request<Pathway>("/api/pathways", { schema_version: "1.0", profile, role_id: roleId, scenario_config: results?.scenario_context }, controller.signal).then(result => { if (!controller.signal.aborted) setPathway(result); }).catch(e => { if (!controller.signal.aborted) setPathError(e instanceof Error ? e.message : "Pathway unavailable."); });
    return () => controller.abort();
  }, [profile, detail, match, roleId]);
  return <FutureRoleShell>
    <Link className="text-button back-to-matches" href={careerHref(roleId)}>← Back to Career Details</Link>
    {(error || pathError) && <div role="alert" className="error-panel">{error || pathError}</div>}
    {!loading && !profile && <p className="notice">Complete your profile to open a personalised pathway.</p>}
    {!loading && profile && match && !match.pathway_available && <p className="notice">A pathway is unavailable until this role can be assessed.</p>}
    {(loading || scoring || profile && match?.pathway_available && !pathway && !pathError) && <p role="status">Finding and checking learning resources...</p>}
    {pathway && bootstrap && <>{pathway.status === "resource_not_found" && <p className="notice small">No verified pathway resources available yet for this role. Coverage remains incomplete.</p>}<PathwayView pathway={pathway} data={bootstrap} /></>}
  </FutureRoleShell>;
}
