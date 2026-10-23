import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { EmploymentSnapshotView, formatCooldown, type EmploymentSnapshotViewProps } from "../src/frontend/app/(workspace)/radar/EmploymentSnapshot";
import Home from "../src/frontend/app/(workspace)/profile/page";
import type { EmploymentDashboard } from "../src/frontend/lib/api";
import RadialProfileRelevance from "../src/frontend/components/RadialProfileRelevance";
import CareerOverview from "../src/frontend/components/CareerOverview";
import type { RoleResult } from "../src/frontend/lib/future-role-session";
import CareerAnalysisPanels from "../src/frontend/components/CareerAnalysisPanels";
import { displaySkillLabel, displayOccupationTitle } from "../src/frontend/lib/career-display";
import CareerCard from "../src/frontend/components/CareerCard";
import type { CareerAnalysis } from "../src/frontend/lib/career-analysis";
import CredentialRecommendations from "../src/frontend/components/CredentialRecommendations";
import PathwayResourceCard from "../src/frontend/components/PathwayResourceCard";
import { resourceAppearance } from "../src/frontend/components/PathwayIcon";
import PathwayView from "../src/frontend/components/PathwayView";
import { registrationToDraft } from "../src/frontend/lib/hybrid-profile";
import type { PathwaayRegistrationProfile } from "../src/frontend/lib/pathwaay-profile";
import type { StoredProfile, SkillOption } from "../src/frontend/lib/api";
import type { Bootstrap, Pathway, Resource, Source } from "../src/frontend/lib/contracts";

// Resolve the app's own React version, with the standalone frontend package.
const requireFrontend = createRequire(new URL("../src/frontend/package.json", import.meta.url));
const { createElement } = requireFrontend("react");
const { renderToStaticMarkup } = requireFrontend("react-dom/server");

const registrationFixture = (): PathwaayRegistrationProfile => ({firstName:"Fixture",lastName:"Learner",educationLevel:"Bachelor’s degree",university:"",major:"Computing",cgpa:"3.5",schoolAwards:"",experiences:[],skills:["Python","SQL","Data Analysis"],educationRecord:"",volunteering:"",projects:"",certifications:"",achievements:"",interests:"",workActivities:"",strengths:"",skillsToDevelop:"",aspiration:"",profileSummary:"",weeklyHours:"",learningBudget:"",learningMode:""});

test("hybrid snapshot retains new Main metadata while skill IDs remain vocabulary validated", () => {
  const main = registrationFixture();
  main.email = "fixture@example.invalid";
  main.skillLinks = [{name:"Python",skill_id:"esco:untrusted",taxonomy_source:"Display metadata"}];
  const vocabulary = [{id:"local:python-programming",name:"Python programming",aliases:["Python"]}] as SkillOption[];
  const draft = registrationToDraft(main,undefined,vocabulary);
  assert.equal(draft.registration_profile?.email,main.email);
  assert.deepEqual(draft.registration_profile?.skillLinks,main.skillLinks);
  assert.equal(draft.skills[0].skill_id,"local:python-programming");
  assert.deepEqual(draft.skills.map(s=>s.name),main.skills);
  assert.equal(draft.skills.length,3);
});

test("hybrid conversion keeps genuine unknowns and exact Main snapshot without inventing ESCO IDs", () => {
  const main = registrationFixture();
  const draft = registrationToDraft(main);
  assert.equal(draft.synthetic_demo, false);
  assert.equal(draft.years_experience, null);
  assert.equal(draft.status, "unknown");
  assert.equal(draft.education_level, "bachelor");
  assert.equal(draft.registration_profile?.cgpa, "3.5");
  assert.ok(draft.skills.every(s => s.proficiency === "unknown" && s.skill_id === null));
  assert.deepEqual(main, registrationFixture());
  main.weeklyHours = "0"; main.learningBudget = "0";
  assert.equal(registrationToDraft(main).learning_preferences.weekly_hours, 0);
  main.learningBudget = "not a number";
  assert.throws(() => registrationToDraft(main), /non-negative/);
});

test("hybrid registration handoff preserves selected ESCO IDs and removes unselected ESCO skills", () => {
  const main = registrationFixture();
  main.skills = ["Python (computer programming)"];
  main.skillLinks = [{
    name: "Python (computer programming)",
    skill_id: "http://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d",
    taxonomy_source: "ESCO v1.2.1",
  }];
  const draft = registrationToDraft(main);
  assert.equal(draft.skills[0].skill_id, main.skillLinks[0].skill_id);
  assert.equal(draft.registration_profile?.skillLinks?.[0].taxonomy_source, "ESCO v1.2.1");

  const saved = {
    ...draft,
    id: "saved-esco",
    created_at: "2026-10-23",
    updated_at: "2026-10-23",
    skills: [{
      skill_id: main.skillLinks[0].skill_id,
      display_name: "Python (computer programming)",
      input_names: ["Python (computer programming)"],
      proficiency: "unknown",
      taxonomy_source: "ESCO v1.2.1",
      is_custom: false,
      evidence_record_ids: [],
    }],
  } as StoredProfile;
  const changed = registrationFixture();
  changed.skills = ["SQL"];
  changed.skillLinks = [];
  assert.equal(registrationToDraft(changed, saved).skills.some(skill => skill.skill_id === main.skillLinks?.[0].skill_id), false);
});

test("hybrid updates retain existing evidence, proficiency and unrelated records", () => {
  const main = registrationFixture();
  const draft = registrationToDraft(main);
  const record = {id:"existing-project", title:"User project", organization:null,period:null,description:"Provided by the user",skill_ids:[]};
  const saved = {...draft,id:"saved",created_at:"2026-10-23",updated_at:"2026-10-23",projects:[record],skills:[{skill_id:"local:python-programming",display_name:"Python programming",input_names:["Python"],proficiency:"advanced",taxonomy_source:"Local prototype vocabulary",is_custom:false,evidence_record_ids:[record.id]}]} as StoredProfile;
  const vocabulary = [{id:"local:python-programming",name:"Python programming",aliases:["Python"]}] as SkillOption[];
  const result = registrationToDraft(main, saved, vocabulary);
  assert.equal(result.skills[0].proficiency, "advanced");
  assert.deepEqual(result.skills[0].evidence_record_ids, [record.id]);
  assert.deepEqual(result.projects, [record]);
  assert.equal(result.skills.length, 3);
  assert.equal(result.years_experience, null);
  main.skills = ["SQL"];
  assert.equal(registrationToDraft(main,saved,vocabulary).skills.some(s => s.skill_id === "local:python-programming"), false);
});

test("occupation title presentation preserves acronyms, brands and punctuation", () => {
  for (const [input, expected] of [
    ["computer vision engineer", "Computer Vision Engineer"],
    ["ai and ICT engineer", "AI and ICT Engineer"],
    ["IT / SQL analyst", "IT / SQL Analyst"],
    ["ios and 3d developer", "iOS and 3D Developer"],
    ["C++ software engineer", "C++ Software Engineer"],
    ["computer-aided design technician", "Computer-Aided Design Technician"],
  ]) assert.equal(displayOccupationTitle(input), expected);
});

test("listing badges distinguish qualified recommendations, search and missing provenance", () => {
  const match = { role_id: "fixture-role", role_title: "computer vision engineer", description: "Original source description.", strengths: [], occupation_source_ids: ["esco-fixture"], esco_release: "v1.2.1", qualification_status: "qualified", score: {profile_relevance_pct: 47.1234} } as RoleResult;
  const render = () => renderToStaticMarkup(createElement(CareerCard, {match}));
  let html = render();
  assert.match(html, /Profile-Based Recommendation/);
  assert.match(html, /ESCO Occupation/);
  assert.ok(html.indexOf("occupation-tags") < html.indexOf("<h3>Computer Vision Engineer</h3>"));
  assert.match(html, /47\.12%/);
  assert.match(html, /Explore More/);
  assert.match(html, /Original source description\./);
  assert.equal(match.role_title, "computer vision engineer");
  const search = {...match, qualification_status: "search_result"} as RoleResult;
  html = renderToStaticMarkup(createElement(CareerCard, {match: search}));
  assert.doesNotMatch(html, /Profile-Based Recommendation/);
  assert.match(html, /ESCO Occupation/);
  search.occupation_source_ids = [];
  html = renderToStaticMarkup(createElement(CareerCard, {match: search}));
  assert.doesNotMatch(html, /ESCO Occupation|Profile-Based Recommendation/);
});

test("pathway origins, response-local evidence and unknowns remain truthful", () => {
  const source = { source_id: "test-online", title: "Fictional provider test evidence", publisher: "Test provider",
    url: "https://example.org/fictional-provider-page", accessed_at: "2026-10-22", evidence_status: "verified" } as Source;
  const resource = { resource_id: "test-course", title: "Fictional learning fixture", provider: "Test provider", url: source.url,
    resource_type: "tutorial", evidence_status: "verified", covers_skill_ids: ["test-skill"], prerequisite_skill_ids: [], prerequisite_resource_ids: [],
    prerequisite_notes: "Review provider requirements.", prerequisite_status: "unknown", duration_hours: null, duration_basis: "unknown",
    cost_status: "unknown", cost: null, source_ids: [source.source_id], coverage_note: "Fictional fixture coverage only.",
    access_notes: "Access not confirmed.", access_verified_at: "2026-10-22", resource_origin: "web_discovered",
    retrieval_mode: "fresh_search", content_verified_at: "2026-10-22T01:00:00Z", time_estimate: null } as Resource;
  const pathway = { role_title: "Fictional role", target_skill_ids: ["test-skill"], uncovered_skill_ids: ["test-uncovered"],
    blocked_resource_ids: [], source_ids: [source.source_id], warnings: ["No eligible verified route for 25 documented gaps. This is a starter pathway.", "Review provider prerequisites."], status: "starter", coverage_complete: false,
    hours_per_week: 4, planning_estimate: null, sources: [source], discovery_status: "mixed",
    discovery_message: "Provider-checked online resources supplemented with reviewed catalogue resources.",
    phases: [{ phase_id: "phase-1", order: 1, title: "Guided Practice", target_skill_ids: ["test-skill"],
      resources: [resource], learning_objectives: [], prerequisite_skill_ids: [], source_ids: [source.source_id], status: "available", phase_kind: "guided_practice" }],
  } as Pathway;
  const data = { skills: [{ skill_id: "test-skill", name: "Fictional skill" }], sources: [] } as unknown as Bootstrap;
  pathway.phases.push({ ...pathway.phases[0], phase_id: "remaining", phase_kind: "remaining_gaps", title: "Remaining Learning Gaps", resources: [], status: "resource_not_found" });
  const render = () => renderToStaticMarkup(createElement(PathwayView, { pathway, data }));
  const html = render();
  for (const text of ["Discovered online", "Provider details checked 2026-10-22", source.title, "Fictional skill"])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Evidence unavailable for test-online|Cost unknown|Not confirmed|Pathway method, scheduling/);
  assert.doesNotMatch(html, /Incomplete|<summary>Remaining Learning Gaps|No eligible verified route for|Back to matching roles|Details &amp; evidence|resource-details/);
  assert.ok(html.includes("1 gaps still need learning resources"));
  pathway.uncovered_skill_ids = [];
  assert.doesNotMatch(render(), /gaps still need learning resources/);
  assert.ok(html.includes("Review provider prerequisites."));
  assert.ok(html.includes(`href="${resource.url}"`));
  resource.retrieval_mode = "cached_verified";
  assert.ok(render().includes("Previously discovered"));
  resource.resource_origin = "local_catalogue";
  pathway.discovery_message = "Online discovery unavailable; showing reviewed local catalogue resources.";
  assert.ok(render().includes("Reviewed catalogue"));
  assert.ok(render().includes(pathway.discovery_message));
});

for (const value of [0, 56.13, 100, null]) {
  test(`radial relevance faithfully represents ${value ?? "unavailable"}`, () => {
    const html = renderToStaticMarkup(createElement(RadialProfileRelevance, { value }));
    assert.match(html, /role="progressbar"/);
    assert.match(html, /not readiness or hiring probability/);
    if (value === null) {
      assert.match(html, /Unavailable/);
      assert.doesNotMatch(html, /aria-valuenow=|class="radial-fill"/);
    } else {
      assert.ok(html.includes(`aria-valuenow="${value}"`));
      assert.ok(html.includes(`${value.toFixed(2)}%`));
      const offset = Number(html.match(/stroke-dashoffset="([^"]+)"/)?.[1]);
      assert.ok(Math.abs(offset - 2 * Math.PI * 50 * (1 - value / 100)) < 0.000001);
    }
  });
}

const fixture: EmploymentDashboard = {
  mode: "real",
  source: {
    id: "remoteok", name: "Remote OK", url: "https://remoteok.com/api", website_url: "https://remoteok.com",
    documentation_url: "https://remoteok.com/faq#feeds-sponsorship", terms_url: "https://remoteok.com/legal",
    terms_reviewed_on: "2026-10-21", permitted_use: "Conditional API reuse with attribution.",
    coverage: "Synthetic international fixture, not representative.",
    measurement: "Exact configured phrase mentions per retained posting.",
    limitations: "Snapshot only. No historical growth or verified open status.", refresh_policy: "Manual; one attempt per 24 hours.", sample_limit: 100,
  },
  jobs: [
    {
      source_job_id: "fixture1", title: "Fictional Python <Engineer>", company: "Example Employer",
      location: null, source_url: "https://remoteok.com/remote-jobs/fixture1",
      source_date: "2026-10-20T00:00:00Z", published_at: "2026-10-20T00:00:00Z",
      retrieved_at: "2026-10-21T00:00:00Z", tags: ["python"], topic_ids: ["llms"],
      skill_mentions: [{ skill_id: "local:python-programming", label: "Python programming", terms: ["python"], fields: ["title"] }],
    },
    {
      source_job_id: "fixture2", title: "Fictional Support", company: "Second Example",
      location: "Remote (synthetic)", source_url: "https://remoteok.com/remote-jobs/fixture2",
      source_date: "2026-10-19T00:00:00Z", published_at: "2026-10-19T00:00:00Z",
      retrieved_at: "2026-10-21T00:00:00Z", tags: [], topic_ids: [], skill_mentions: [],
    },
  ],
  skill_counts: [{ skill_id: "local:python-programming", label: "Python programming", posting_count: 1, share_percent: 50 }],
  topic_counts: { llms: 1, rag: 0 }, posting_count: 2, employer_count: 2,
  location_labels: ["Remote (synthetic)"], unknown_location_count: 1,
  published_from: "2026-10-19T00:00:00Z", published_to: "2026-10-20T00:00:00Z",
  source_feed_updated_at: "2026-10-21T00:00:00Z", received_records: 2, excluded_records: 0,
  last_successful_refresh: "2026-10-21T00:00:00Z", last_attempt_at: "2026-10-21T00:00:00Z",
  refresh_status: "success", cooldown_seconds: 0, cache_fallback: false, error_message: null,
};

function render(overrides: Partial<EmploymentSnapshotViewProps> = {}) {
  return renderToStaticMarkup(createElement(EmploymentSnapshotView, {
    dashboard: fixture, loading: false, refreshing: false, error: "", cooldownSeconds: 0,
    onRetry: () => {}, onRefresh: () => {}, ...overrides,
  }));
}

test("profile component exposes the safe handoff loading state before reading browser profile data", () => {
  const html = renderToStaticMarkup(createElement(Home));
  assert.match(html, /Opening your completed profile/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /data-testid="button-save-profile"/);
});

test("employment component renders attributed records, denominator and escaped text", () => {
  const html = render();
  assert.match(html, /2 retained \(denominator\)/);
  assert.match(html, /Fictional Python &lt;Engineer&gt;/);
  assert.match(html, /Location unspecified/);
  assert.match(html, /Original source date/);
  assert.match(html, /rel="noopener noreferrer" data-testid="link-job-fixture1"/);
  assert.doesNotMatch(html, /nofollow/);
  assert.match(html, /not a confirmed requirement/);
  assert.match(html, /50%/);
});

test("loading and empty caches do not manufacture postings", () => {
  assert.match(render({ dashboard: null, loading: true }), /data-testid="loading-employment"/);
  const html = render({ dashboard: { ...fixture, jobs: [], posting_count: 0, skill_counts: [] } });
  assert.match(html, /data-testid="empty-employment"/);
  assert.doesNotMatch(html, /data-testid="job-fixture1"/);
});

test("provider and retry errors leave existing cached postings visible", () => {
  const html = render({ dashboard: { ...fixture, refresh_status: "failed", cache_fallback: true, error_message: "Synthetic timeout" }, error: "Synthetic read failure" });
  assert.match(html, /Showing the previous cached snapshot/);
  assert.match(html, /data-testid="button-retry-employment"/);
  assert.match(html, /data-testid="job-fixture1"/);
  assert.match(render({ loading: true }), /data-testid="job-fixture1"/);
});

test("topic and skill filters restrict actual record cards and explain zero matches", () => {
  for (const filter of [{ initialTopicFilter: "llms" }, { initialSkillFilter: "local:python-programming" }]) {
    const html = render(filter);
    assert.match(html, /data-testid="job-fixture1"/);
    assert.doesNotMatch(html, /data-testid="job-fixture2"/);
  }
  const empty = render({ initialTopicFilter: "rag" });
  assert.match(empty, /data-testid="empty-employment-filtered"/);
  assert.match(empty, /zero matches in this sample only/);
});

test("profile relevance uses exact IDs only and cooldown is not invented", () => {
  const html = render({ profileSkills: [{ skill_id: null, skill_name: "Python programming" }], cooldownSeconds: 86399 });
  assert.match(html, /None of your saved skill IDs match/);
  assert.match(html, /Next refresh in 23h 59m/);
  assert.equal(formatCooldown(-5), "0s");
  assert.equal(formatCooldown(63), "1m 3s");
});


test("credential section preserves origins and fees without per-card evidence disclosures", () => {
  const pathway = { phases: [], credentials: [{ credential_id: "mock", title: "Fictional Credential <test>", provider: "Test provider", url: "https://example.org/credential", credential_type: "certification_exam", skill_ids: ["mock-skill"], assessment_format: "Exam", prerequisites: null, fees_verified_free: false, exam_fee: {amount: 20, currency: "USD"}, certificate_fee: null, origin: "web_discovered", checked_at: "2026-10-22T00:00:00Z", evidence: {credential: "Fictional evidence", assessment: "Fictional assessed exam", exam_fee: "Exam fee: USD 20"}, source_urls: ["https://example.org/credential"] }] } as Pathway;
  const render = () => renderToStaticMarkup(createElement(CredentialRecommendations, {pathway, skillName: () => "Mock skill"}));
  const html = render();
  for (const text of ["Certifications &amp; Skill Assessments", "Discovered online", "20 USD", "Mock skill", "Fictional Credential &lt;test&gt;"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Unknown|Not confirmed|Certificate fee:|Prerequisites:/);
  assert.doesNotMatch(html, /resource-details|Official sources &amp; evidence|Fictional evidence/);
  pathway.credentials![0].origin = "local_catalogue";
  pathway.credential_used_cache = true;
  assert.ok(render().includes("Reviewed catalogue"));
  assert.ok(render().includes("Previously checked"));
  pathway.credentials = [];
  assert.ok(render().includes("No verified credential recommendations"));
});


test("career analysis renders one occupation source and noninteractive matrix tiles", () => {
  const analysis = {role_id: "mock", evidence_key: "test", status: "unavailable", message: "AI analysis unavailable.", matched: [], not_evidenced_count: 1, grouping_warning: null, interpretations: [], bridges: [], evidence: [], used_cache: false,
    groups: [{group_id: "mock-group", concept_uri: "http://data.europa.eu/esco/skill/mock-group", title: "Mock <group>", count: 1, mapping_method: "source_concept_fallback", explanation: "One requirement is not evidenced.", concepts: [{skill_id: "https://data.europa.eu/esco/skill/mock", name: "Mock skill", skill_type: "skill", requirement: "optional", source_ids: []}]}]} as CareerAnalysis;
  const html = renderToStaticMarkup(createElement(CareerAnalysisPanels, {analysis, occupationSourceUrl: "http://data.europa.eu/esco/occupation/mock-role"}));
  assert.equal((html.match(/class="career-analysis-card"/g) ?? []).length, 3);
  assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
  assert.match(html, /aria-selected="true"[^>]*>Not Evidenced/);
  for (const text of ["Skill Gap Impact Analysis", "Transferable Skills Mapping", "Skill Evidence Matrix", "Mock &lt;Group&gt;", "AI analysis unavailable", "No Recognised Skills Match This Role Yet"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Simulator|Practical Skill Challenges|View Source Skills|concept-evidence/);
  assert.equal((html.match(/Source: ESCO Occupational Skills/g) ?? []).length, 1);
  assert.match(html, /href="http:\/\/data.europa.eu\/esco\/occupation\/mock-role"/);
  assert.match(html, /class="matrix-concept-label">Concepts:/);
});

test("missing career analysis still renders evidence and bridge fallback without invented output", () => {
  const html = renderToStaticMarkup(createElement(CareerAnalysisPanels, {analysis: null, error: "AI analysis unavailable."}));
  assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
  assert.ok(html.includes("AI analysis unavailable."));
  assert.ok(html.includes("Skill Evidence Needed"));
});


test("career display casing preserves source brands and acronyms", () => {
  assert.equal(displaySkillLabel("carry out calculations"), "Carry Out Calculations");
  assert.equal(displaySkillLabel("principles of artificial intelligence"), "Principles of Artificial Intelligence");
  assert.equal(displaySkillLabel("collect ICT data"), "Collect ICT Data");
  assert.equal(displaySkillLabel("AI SQL ICT ETL API Python Power BI JavaScript MySQL eBay"), "AI SQL ICT ETL API Python Power BI JavaScript MySQL eBay");
});

test("career previews remain bounded and matrix labels omit numerical concept badges", () => {
  const concepts = Array.from({length: 11}, (_, i) => ({skill_id: `http://data.europa.eu/esco/skill/mock-${i}`, name: `original mock concept ${i}`, skill_type: "skill", requirement: "essential", source_ids: []}));
  const analysis = {role_id: "mock", evidence_key: "many", status: "unavailable", message: "AI analysis unavailable", matched: concepts.slice(0, 6), not_evidenced_count: 11, grouping_warning: null, interpretations: [], bridges: [], evidence: [], used_cache: false,
    groups: concepts.map((c, i) => ({group_id: `mock-${i}`, concept_uri: c.skill_id, title: `mock group ${i}`, count: 1, mapping_method: "source_concept_fallback", explanation: "Do not repeat technical paragraphs", concepts: [c]}))} as CareerAnalysis;
  const html = renderToStaticMarkup(createElement(CareerAnalysisPanels, {analysis, occupationSourceUrl: "http://data.europa.eu/esco/occupation/mock-role"}));
  assert.equal((html.match(/class="gap-capability"/g) ?? []).length, 4);
  assert.equal((html.match(/class="matrix-capability"/g) ?? []).length, 4);
  assert.ok(html.includes("Not Evidenced (11)"));
  assert.ok(html.includes("Matched (6)"));
  assert.ok(html.includes("Explore 7 More Capability Groups"));
  assert.ok(html.includes("AI Skill Connections Aren&#x27;t Available Yet"));
  assert.doesNotMatch(html, /source-skills-content|Do not repeat technical paragraphs|mock group 10/i);
  const matrix = html.slice(html.indexOf('class="matrix-capability"'), html.indexOf('class="about-career-analysis"'));
  assert.doesNotMatch(matrix, /class="concept-count"|<summary|View Source Skills/);
  assert.equal((matrix.match(/class="matrix-concept-label">Concepts:/g) ?? []).length, 4);
});


for (const value of [0, 47.1234, 100, null]) {
  test(`overview preserves backend relevance ${value ?? "unavailable"} and exposes one pathway link`, () => {
    const role = {role_id: "http://data.europa.eu/esco/occupation/test-role", title: "Fictional role <test>", description: "Fictional source description for rendering tests only.", source_ids: []};
    const match = {score: {profile_relevance_pct: value, matched_recognised_skill_count: 2}, not_evidenced_essential_count: 5, pathway_available: value !== null} as RoleResult;
    const html = renderToStaticMarkup(createElement(CareerOverview, {role, match, hasProfile: true, scoring: false, sourceUrl: role.role_id, pathwayHref: "/role-matching/roles/test-role/pathway"}));
    assert.ok(html.includes(value === null ? "Unavailable" : `${value.toFixed(2)}%`));
    assert.equal((html.match(/Explore Pathway/g) ?? []).length, 1);
    assert.equal((html.match(/data-testid="role-description"/g) ?? []).length, 1);
    assert.ok(html.includes("Fictional role &lt;test&gt;"));
    assert.ok(html.includes("Matched Profile Concepts"));
    assert.ok(html.includes("Essential Concepts Not Evidenced"));
    assert.ok(html.includes("Relevance does not indicate career readiness or hiring probability."));
    assert.ok(html.includes('href="/role-matching/sdg?role_id=http%3A%2F%2Fdata.europa.eu%2Fesco%2Foccupation%2Ftest-role"'));
    assert.doesNotMatch(html, /Very high match|High digital intensity|Research &amp; Development|scoring-footer/);
    if (value === null) assert.match(html, /role="link" aria-disabled="true"/);
    else assert.match(html, /class="overview-pathway-link" href="\/role-matching\/roles\/test-role\/pathway"/);
  });
}

test("overview omits absent profile metrics and unsafe sources without invented placeholders", () => {
  const role = {role_id: "test-only", title: "Other fictional role", description: "Different fictional evidence.", source_ids: []};
  const html = renderToStaticMarkup(createElement(CareerOverview, {role, match: null, hasProfile: false, scoring: false, sourceUrl: "https://example.org/untrusted", pathwayHref: "/unused"}));
  assert.ok(html.includes("Other fictional role"));
  assert.ok(html.includes("Different fictional evidence."));
  assert.ok(html.includes("Unavailable"));
  assert.doesNotMatch(html, /Matched Profile Concepts|Essential Concepts Not Evidenced|View Source|example.org/);
  assert.match(html, /role="link" aria-disabled="true"/);
});


test("pathway optional metadata is omitted unless supported and type icons are deterministic", () => {
  const resource = {resource_id: "mock", title: "Fictional long resource title for presentation only", provider: "Test provider", url: "https://example.org/mock", resource_type: "unrecognised", evidence_status: "verified", cost_status: "unknown", cost: null, covers_skill_ids: [], prerequisite_resource_ids: [], prerequisite_skill_ids: [], prerequisite_status: "unknown", prerequisite_notes: "Not confirmed", duration_hours: null, duration_basis: "unknown", access_verified_at: "invalid", access_notes: "Price not confirmed", source_ids: [], time_estimate: null, coverage_note: "", resource_origin: undefined} as unknown as Resource;
  const render = () => renderToStaticMarkup(createElement(PathwayResourceCard, {resource, earlierTitles: []}));
  let html = render();
  assert.match(html, /data-resource-icon="book"/);
  assert.doesNotMatch(html, /Unknown|unknown|Unavailable|Not confirmed|Prerequisites:|resource-duration|FREE CONTENT|Beginner|Intermediate|Video|resource-origin/);
  resource.resource_type = "course"; resource.cost_status = "free";
  resource.prerequisite_status = "provider_stated"; resource.prerequisite_notes = "None";
  resource.time_estimate = {value: 2, unit: "hour", basis: "provider_published", published_by_provider: true, rule_id: null, notes: "Provider-stated course duration."};
  html = render();
  for (const text of ['data-resource-icon="course"', "Online course", "FREE CONTENT", "2 hr", "provider’s estimate", "Prerequisites: None"]) assert.ok(html.includes(text), text);
  resource.time_estimate = {...resource.time_estimate, basis: "reviewed_app_estimate", published_by_provider: false};
  assert.ok(render().includes("reviewed app estimate"));
  assert.ok(!render().includes("provider’s estimate"));
  resource.time_estimate = {...resource.time_estimate, value: 0};
  assert.ok(!render().includes("resource-duration"));
  for (const [type, icon] of [["course", "course"], ["video", "video"], ["article", "file"], ["documentation", "book"], ["exercise", "code"], [undefined, "book"]] as const) assert.equal(resourceAppearance(type).icon, icon);
});

test("credential cards omit unsupported individual fields while retaining real source evidence", () => {
  const pathway = { phases: [], credentials: [{credential_id: "mock", title: "Fictional credential", provider: "", url: "https://example.org/test", credential_type: "skill_assessment", skill_ids: [], assessment_format: null, prerequisites: "Not confirmed", exam_fee: {amount: 50, currency: "USD"}, certificate_fee: null, fees_verified_free: false, checked_at: "invalid", evidence: {credential: "Fictional assessed credential evidence"}, source_urls: ["https://example.org/test"]}] } as unknown as Pathway;
  const html = renderToStaticMarkup(createElement(CredentialRecommendations, {pathway, skillName: (id: string) => id}));
  assert.match(html, /data-resource-icon="award"/);
  assert.doesNotMatch(html, /<details|Official sources &amp; evidence/);
  assert.doesNotMatch(html, /Prerequisites:|Exam fee:|Certificate fee:|Assessment:|Not confirmed|Unknown|Checked invalid|50 USD/);
});
