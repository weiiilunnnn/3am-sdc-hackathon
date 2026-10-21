"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getEmployment, getSkills, getTrends,
  type EmploymentDashboard, type SkillOption, type SkillsResponse, type TrendDashboard,
} from "@/lib/api";
import { PageIntro } from "../WorkspaceStates";
import { useSavedProfile } from "../profile-workspace";

type Category = "relevant" | "all" | "interests" | "most" | "least" | "research" | "exposure" | "increasing" | "decreasing";
type CatalogueEntry = {
  id: string;
  name: string;
  taxonomy: string;
  aliases: string[];
  skill: SkillOption | null;
  isProfileSkill: boolean;
  evidence: EmploymentDashboard["skill_counts"][number] | null;
};
const CATEGORY_LABELS: Record<Category, string> = {
  relevant: "Relevant to my profile",
  all: "All skills",
  interests: "Related to my interests",
  most: "Most mentioned in job postings",
  least: "Least mentioned in job postings",
  research: "Emerging AI research topics",
  exposure: "Potential AI exposure",
  increasing: "Increasing employment demand",
  decreasing: "Decreasing employment demand",
};

function tokens(value: string) {
  return new Set(value.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((part) => part.length > 2));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not supplied";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function ExplorePage() {
  const { profile, loading: profileLoading, error: profileError, reload: reloadProfile } = useSavedProfile();
  const [query, setQuery] = useState("");
  const [taxonomy, setTaxonomy] = useState<SkillsResponse["taxonomy"] | null>(null);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [employment, setEmployment] = useState<EmploymentDashboard | null>(null);
  const [trends, setTrends] = useState<TrendDashboard | null>(null);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [loadingEvidence, setLoadingEvidence] = useState(true);
  const [error, setError] = useState("");
  const [evidenceError, setEvidenceError] = useState("");
  const [category, setCategory] = useState<Category>("relevant");
  const [sort, setSort] = useState<"name" | "high" | "low">("name");
  const [taxonomyFilter, setTaxonomyFilter] = useState("all");

  const loadSkills = useCallback(async (term: string) => {
    setLoadingSkills(true);
    setError("");
    try {
      const result = await getSkills(term.trim());
      setTaxonomy(result.taxonomy);
      setSkills(result.skills);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The local skill vocabulary could not be loaded.");
    } finally { setLoadingSkills(false); }
  }, []);
  const loadEvidence = useCallback(async () => {
    setLoadingEvidence(true);
    setEvidenceError("");
    try {
      const [market, research] = await Promise.all([getEmployment(), getTrends()]);
      setEmployment(market);
      setTrends(research);
    } catch (reason) {
      setEvidenceError(reason instanceof Error ? reason.message : "Cached evidence could not be loaded.");
    } finally { setLoadingEvidence(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSkills(query), 220);
    return () => window.clearTimeout(timer);
  }, [query, loadSkills]);
  useEffect(() => { void loadEvidence(); }, [loadEvidence]);

  const profileIds = useMemo(() => new Set((profile?.skills ?? []).map((skill) => skill.skill_id).filter((id): id is string => Boolean(id))), [profile]);
  const profileLabels = useMemo(() => new Set((profile?.skills ?? []).map((skill) => skill.display_name.toLocaleLowerCase().trim())), [profile]);
  const marketCounts = useMemo(() => new Map((employment?.skill_counts ?? []).map((item) => [item.skill_id, item])), [employment]);
  const categories = Object.keys(CATEGORY_LABELS) as Category[];
  const catalogue = useMemo<CatalogueEntry[]>(() => {
    const entries: CatalogueEntry[] = skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      taxonomy: skill.taxonomy_source,
      aliases: skill.aliases,
      skill,
      isProfileSkill: profileIds.has(skill.id) || profileLabels.has(skill.name.toLocaleLowerCase().trim()),
      evidence: marketCounts.get(skill.id) ?? null,
    }));
    for (const skill of profile?.skills ?? []) {
      if (skill.skill_id || entries.some((entry) => entry.name.toLocaleLowerCase() === skill.display_name.toLocaleLowerCase())) continue;
      entries.push({
        id: `custom:${skill.display_name.toLocaleLowerCase()}`,
        name: skill.display_name,
        taxonomy: "Custom profile entry",
        aliases: [],
        skill: null,
        isProfileSkill: true,
        evidence: null,
      });
    }
    return entries;
  }, [skills, profile, profileIds, profileLabels, marketCounts]);
  const interestTokens = useMemo(() => new Set((profile?.interests ?? []).flatMap((interest) => [...tokens(interest)])), [profile]);

  const filtered = useMemo(() => {
    let result = catalogue;
    if (category === "relevant") result = result.filter((entry) => entry.isProfileSkill);
    else if (category === "interests") {
      result = result.filter((entry) => [...tokens(`${entry.name} ${entry.aliases.join(" ")}`)].some((token) => interestTokens.has(token)));
    } else if (category === "most" || category === "least") {
      result = result.filter((entry) => entry.evidence !== null);
    } else if (category === "research") {
      result = [];
    }
    if (taxonomyFilter !== "all" && category !== "research") result = result.filter((entry) => entry.taxonomy === taxonomyFilter);
    const needle = query.trim().toLocaleLowerCase();
    if (needle) result = result.filter((entry) => `${entry.name} ${entry.aliases.join(" ")}`.toLocaleLowerCase().includes(needle));
    return [...result].sort((a, b) => {
      if (category === "most" || category === "least") {
        const difference = (a.evidence?.posting_count ?? 0) - (b.evidence?.posting_count ?? 0);
        if (difference !== 0) return category === "most" ? -difference : difference;
      } else if (sort !== "name") {
        if (Boolean(a.evidence) !== Boolean(b.evidence)) return a.evidence ? -1 : 1;
        const difference = (a.evidence?.posting_count ?? 0) - (b.evidence?.posting_count ?? 0);
        if (difference !== 0) return sort === "high" ? -difference : difference;
      }
      return a.name.localeCompare(b.name);
    });
  }, [catalogue, category, interestTokens, query, sort, taxonomyFilter]);
  const topics = useMemo(() => (trends?.topics ?? [])
    .filter((topic) => topic.observations.length > 0 && topic.change.status === "available" && (topic.change.absolute_change ?? 0) > 0)
    .filter((topic) => !query.trim() || `${topic.label} ${topic.definition}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => (b.change.absolute_change ?? 0) - (a.change.absolute_change ?? 0) || a.label.localeCompare(b.label)), [trends, query]);
  const sources = useMemo(() => Array.from(new Set(catalogue.map((skill) => skill.taxonomy))).sort(), [catalogue]);
  const unsupported = category === "exposure" || category === "increasing" || category === "decreasing";
  const marketUnavailable = category === "most" || category === "least";

  return <main className="page-wrap">
    <PageIntro kicker="SKILLS EXPLORER · AVAILABLE EVIDENCE" title={<>Browse with context,<br />not rankings alone.</>} description="Search and filter a small local skill vocabulary. Market counts are exact keyword mentions in one retained posting sample; research observations stay separate." index="REFERENCE / 03" />
    <div className="notice" role="note"><span className="notice-icon" aria-hidden="true">i</span><div><strong>Evidence has limits</strong>Neither a missing posting mention nor low research activity says a skill is unimportant. This prototype does not measure hiring outcomes or AI replacement risk.</div></div>

    <section className="catalogue-tools explorer-tools" aria-label="Skill evidence filters">
      <label className="field catalogue-search"><span className="label-text">Search names, aliases or topics</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try communication, planning, or AI…" /></label>
      <label className="field"><span className="label-text">Show</span><select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{categories.map((value) => <option key={value} value={value} disabled={value === "exposure" || value === "increasing" || value === "decreasing"}>{CATEGORY_LABELS[value]}{value === "exposure" ? " · unavailable" : value === "increasing" || value === "decreasing" ? " · needs history" : ""}</option>)}</select></label>
      <label className="field"><span className="label-text">Vocabulary source</span><select value={taxonomyFilter} onChange={(event) => setTaxonomyFilter(event.target.value)} disabled={category === "research"}><option value="all">All sources</option>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
      <label className="field"><span className="label-text">Sort skill list</span><select value={category === "most" ? "high" : category === "least" ? "low" : sort} onChange={(event) => setSort(event.target.value as typeof sort)} disabled={category === "most" || category === "least" || category === "research"}><option value="name">Name · A to Z</option><option value="high">Posting mentions · high to low</option><option value="low">Posting mentions · low to high</option></select></label>
    </section>
    <p className="field-hint explorer-availability">Unavailable filters stay visible: AI exposure needs a defensible task-to-skill dataset; increasing or decreasing employment demand needs comparable historical snapshots.</p>
    <div className="catalogue-actions"><p className="status-line" aria-live="polite">{category === "research" ? `${topics.length} research topics shown` : `${filtered.length} ${filtered.length === 1 ? "skill" : "skills"} shown`}{category === "interests" && " · name shares a complete word with a stated interest"}</p><button type="button" className="button ghost small" onClick={() => { setQuery(""); setCategory("all"); setTaxonomyFilter("all"); setSort("name"); }}>Clear filters</button></div>

    {profileError && <div className="message error" role="alert">{profileError} <button type="button" className="button ghost small" onClick={() => void reloadProfile()}>Retry saved profile</button></div>}
    {category === "relevant" && !profileLoading && !profile && <div className="message info">Save a fictional profile to use this filter. Choose “All skills” to browse the vocabulary without a profile.</div>}
    {category === "interests" && !profileLoading && !profile?.interests.length && <div className="message info">Add interests to your profile before using this exploratory word-overlap filter.</div>}
    {loadingEvidence && <div className="message info" role="status">Loading the cached employment and research evidence. No source refresh is triggered.</div>}
    {evidenceError && <div className="message error" role="alert">{evidenceError} <button type="button" className="button ghost small" onClick={() => void loadEvidence()}>Retry evidence</button></div>}
    {taxonomy && <div className="catalogue-source"><span className="mode-pill">LOCAL VOCABULARY</span><p>{taxonomy.status_note}</p><small>{taxonomy.name} · version {taxonomy.version} · reviewed {taxonomy.reviewed_on}</small>{taxonomy.classification_url && <a href={taxonomy.classification_url} target="_blank" rel="noreferrer">Vocabulary reference ↗</a>}</div>}

    {unsupported && <div className="panel message info unavailable-metric" role="status"><strong>{CATEGORY_LABELS[category]} is unavailable.</strong> {category === "exposure" ? "This app has no task- or occupation-level AI exposure dataset with a validated skill mapping." : "The app has one posting snapshot and no comparable historical employment periods. A single collection cannot show increasing or decreasing demand."} No estimates or replacement-risk percentages are generated.</div>}
    {marketUnavailable && !loadingEvidence && (!employment || employment.posting_count === 0) && <div className="panel message info" role="status">No retained employment sample is available. Posting rankings cannot be calculated until a real snapshot has been collected.</div>}
    {loadingSkills ? <div className="catalogue-grid" role="status" aria-label="Loading skill catalogue">{[0, 1, 2, 3, 4, 5].map((item) => <div className="skeleton catalogue-skeleton" key={item} />)}</div> : !error && category !== "research" && !unsupported && filtered.length === 0 && !(category === "relevant" && !profile) && !(category === "interests" && !profile?.interests.length) ? <div className="panel state-panel empty-state"><span className="empty-mark" aria-hidden="true">0</span><h2>No matching evidence in this view.</h2><p>Try another filter or search term. A zero match is specific to this vocabulary or sample, not a statement about skill importance.</p><button type="button" className="button secondary" onClick={() => { setQuery(""); setCategory("all"); setTaxonomyFilter("all"); }}>Show all skills</button></div> : null}

    {!loadingSkills && !error && !unsupported && category !== "research" && filtered.length > 0 && <div className="catalogue-grid">{filtered.map((entry) => {
      const measured = Boolean(entry.evidence && employment?.posting_count);
      const share = measured ? `${entry.evidence!.share_percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : null;
      return <article className="panel catalogue-card" key={entry.id}>
        <div className="catalogue-card-top"><span className="catalogue-mark" aria-hidden="true">S</span><span className="topic-tag">{entry.isProfileSkill ? "IN YOUR PROFILE" : entry.taxonomy}</span></div>
        <h2>{entry.name}</h2><p className="skill-source">{entry.id.startsWith("custom:") ? "Custom profile entry · no local taxonomy ID" : `Skill ID · ${entry.id}`}</p>
        <div className="explorer-metric">{measured ? <><strong>{entry.evidence!.posting_count} / {employment!.posting_count}</strong><span>Remote OK posting mentions · {share}</span></> : <><strong>No configured measure</strong><span>{employment?.posting_count ? "This vocabulary entry is not in the posting keyword set." : "No retained posting denominator is available."}</span></>}</div>
        <p className="field-hint">{entry.isProfileSkill ? "This label is already in the saved profile; it is not a career match." : "Browse label only. No proficiency assessment is implied."}</p>
        <Link className="text-link" href={entry.isProfileSkill ? "/profile#skills-section" : "/profile"}>{entry.isProfileSkill ? "Review this skill in your profile →" : "Open profile to add or review →"}</Link>
        <details><summary>How to interpret this skill</summary><dl className="catalogue-detail">
          <div><dt>Definition</dt><dd>{entry.skill ? "The local vocabulary record does not provide a validated definition." : "No taxonomy definition is available for this custom profile entry."}</dd></div>
          <div><dt>Aliases</dt><dd>{entry.aliases.length ? entry.aliases.join(", ") : "No aliases supplied"}</dd></div>
          <div><dt>Posting measure</dt><dd>{measured ? `${entry.evidence!.posting_count} of ${employment!.posting_count} retained postings contain a configured phrase (${share}). Each posting counts once for this skill.` : "No configured phrase measurement is available for this skill; no zero is inferred."}</dd></div>
          <div><dt>Source</dt><dd>{employment && measured ? <a href={employment.source.url} target="_blank" rel="noreferrer">{employment.source.name} feed ↗</a> : "No employment source measurement"}</dd></div>
          <div><dt>Published</dt><dd>{measured ? `${formatDate(employment?.published_from)} – ${formatDate(employment?.published_to)}` : "Not available"}</dd></div>
          <div><dt>Retrieved</dt><dd>{measured ? formatDate(employment?.last_successful_refresh) : "Not available"}</dd></div>
          <div><dt>Coverage</dt><dd>{measured ? `${employment!.posting_count} retained records from one international remote-job board; not a representative global or country sample.` : "Not measured in this snapshot."}</dd></div>
          <div><dt>Calculation</dt><dd>{measured ? `Number of retained postings with an exact configured phrase in title, tags or description; share = posting count ÷ ${employment!.posting_count} × 100.` : "No calculation is made without a configured phrase and denominator."}</dd></div>
          <div><dt>Limitations</dt><dd>{employment?.source.limitations ?? "No market signal is available. OpenAlex research activity is separate and is not a hiring measure."}</dd></div>
          {entry.skill && <><div><dt>Vocabulary source</dt><dd>{entry.taxonomy} · {entry.skill.source_version ?? "version not supplied"}</dd></div><div><dt>Reference</dt><dd>{entry.skill.source_url ? <a href={entry.skill.source_url} target="_blank" rel="noreferrer">Open taxonomy record ↗</a> : "Local term; no external concept URI"}</dd></div></>}
        </dl></details>
      </article>;
    })}</div>}

    {category === "research" && <section className="research-explorer" aria-label="Dated AI research topics">
      {trends?.mode === "synthetic" && <div className="message info"><strong>Synthetic research demonstration.</strong> These observations are fictional and are not OpenAlex records.</div>}
      {!loadingEvidence && trends?.mode === "real" && topics.length === 0 && <div className="message info">No OpenAlex topics have both a comparable period and a positive change in the cached publication counts. This is research activity only, not hiring growth.</div>}
      {!loadingEvidence && topics.length > 0 && <div className="outlook-research-list">{topics.map((topic) => {
        const latest = [...topic.observations].sort((a, b) => b.period_year - a.period_year)[0];
        return <article className="panel research-topic" key={topic.topic_id}>
          <div className="research-topic-head"><div><span className="topic-tag">RESEARCH · {trends?.mode === "real" ? "REAL CACHE" : "SYNTHETIC"}</span><h3>{topic.label}</h3></div><span className="research-topic-count">{latest.value.toLocaleString()}<small>{latest.period_year} records</small></span></div>
          <p>{topic.definition}</p><dl className="topic-meta"><div className="meta-item"><dt>Measurement</dt><dd>{topic.measurement}</dd></div><div className="meta-item"><dt>Compared change</dt><dd>{topic.change.status === "available" ? `${topic.change.absolute_change} records from ${topic.change.compared_years?.join(" to ")}` : topic.change.explanation}</dd></div><div className="meta-item"><dt>Source</dt><dd>{topic.source_name}{topic.source_url && <> · <a href={topic.source_url} target="_blank" rel="noreferrer">Query/source record ↗</a></>}</dd></div><div className="meta-item"><dt>Retrieved</dt><dd>{formatDate(latest.retrieved_at)}</dd></div><div className="meta-item"><dt>Limitations</dt><dd>{topic.limitations} This is research activity, not job demand.</dd></div></dl>
        </article>;
      })}</div>}
    </section>}
    <p className="catalogue-footer">Remote OK postings and OpenAlex research records are separate evidence types. A single job-board snapshot cannot establish employment growth; isolated skill labels cannot establish AI exposure.</p>
  </main>;
}
