"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import WorkspaceNav from "../WorkspaceNav";

type Goal = { number: string; title: string; target: string; reason: string };
type Skill = { name: string; goals: string[]; reason: string };
type ScenarioView = { title: string; body: string; focus: string[] };
type Scenario = "moderate" | "fast";
type TaskShift = { routine: string; human: string; signals: Record<Scenario, string> };
type Career = {
  title: string;
  stage: string;
  summary: string;
  contribution: string;
  goals: Goal[];
  skills: Skill[];
  taskShift: TaskShift;
  scenarios: Record<Scenario, ScenarioView>;
};

type Recommendation = { role: string; score: number; skills: string[] };
type SkillProjection = { skill: string; demand_index: number };
type CareerModelResult = {
  recommendations: Recommendation[];
  scenario_estimates: Record<Scenario, Array<{ role: string; year: number; skills: SkillProjection[] }>>;
  model: string;
  data_notice: string;
};
type SDGExplanation = {
  role_contribution: string;
  skill_links: Array<{ skill: string; explanation: string }>;
  model: string;
};
type SDGOverview = {
  sdg_number: string;
  main_contribution: string;
  target_previews: Array<{ code: string; explanation: string }>;
  model: string;
};
type SDGRecommendation = {
  role: string;
  recommended_sdg: string;
  ranked_sdgs: Array<{
    number: string;
    title: string;
    summary: string;
    icon_url: string;
    relative_fit: number;
    mapped_skill_count: number;
    target_codes: string[];
    targets: Array<{ code: string; title: string; definition: string }>;
  }>;
  skill_mappings: Array<{ name: string; goals: string[] }>;
  data_notice: string;
};
type DemoProfile = {
  label: string; aspiration: string; field_of_study: string; years_experience: number;
  interests: string[]; skills: { id: string | null; name: string }[];
};
const interestOptions = ["analytics", "ai", "business", "building", "communication", "product", "research"];
const skillOptions = ["python", "sql", "statistics", "visualization", "machine_learning", "cloud"];

const goalInfo: Record<string, { title: string; target: string }> = {
  "4.3": { title: "Quality Education", target: "Target 4.3 · Equal access to technical, vocational and tertiary education" },
  "4.4": { title: "Quality Education", target: "Target 4.4 · Build skills for employment and decent work" },
  "8.2": { title: "Decent Work and Economic Growth", target: "Target 8.2 · Raise productivity through technology and innovation" },
  "8.5": { title: "Decent Work and Economic Growth", target: "Target 8.5 · Support productive employment and decent work" },
};

const sdgIconUrl = (number: string) => `https://open-sdg.github.io/sdg-translations/assets/img/goals/en/${Number(number)}.png`;

const careers: Career[] = [
  {
    title: "Data Analyst",
    stage: "Recommended role · 0–12 months",
    summary: "Clean, analyse and explain business data to help teams make informed decisions.",
    contribution: "By turning data into useful evidence, this work can help organisations improve productivity (8.2). Building practical analytics skills can support access to skilled work (4.4). A role’s actual contribution depends on how the organisation uses its analysis.",
    goals: [
      { number: "4.3", ...goalInfo["4.3"], reason: "Showing the skills and next-step role can help learners identify relevant technical or vocational learning; this demo does not provide or measure access to training." },
      { number: "8.2", ...goalInfo["8.2"], reason: "Clear analysis can help teams find inefficiencies, track results and make better use of resources." },
      { number: "4.4", ...goalInfo["4.4"], reason: "The path builds practical data skills that are relevant to employment in a digital economy." },
      { number: "8.5", ...goalInfo["8.5"], reason: "A structured entry path can help learners prepare for productive analyst work; it cannot guarantee job quality or employment." },
    ],
    skills: [
      { name: "SQL", goals: ["4.4"], reason: "A practical technical skill for retrieving and working with data in many analyst roles." },
      { name: "Data cleaning", goals: ["4.4"], reason: "Builds applied data handling ability used in workplace analysis." },
      { name: "Business metrics", goals: ["8.2"], reason: "Helps teams measure performance and identify where processes can improve." },
      { name: "Analytical reasoning", goals: ["8.2"], reason: "Connects evidence to useful decisions about productivity and outcomes." },
    ],
    taskShift: { routine: "query drafts, data cleaning, charting and first-pass summaries", human: "choosing useful measures, checking data quality and explaining caveats", signals: { moderate: "Job ads begin asking analysts to review AI-generated queries and summaries.", fast: "Teams move basic cleaning and charting into natural-language self-serve tools." } },
    scenarios: {
      moderate: { title: "AI assists the reporting workflow", body: "AI helps draft queries, clean routine data and summarise results. Analysts still check data quality, choose useful measures and explain what findings mean for the business.", focus: ["Validate AI-generated queries and summaries", "Strengthen business question framing", "Practise explaining insights"] },
      fast: { title: "Routine analysis is automated more often", body: "More basic cleaning, charting and first-draft summaries are handled by AI tools. Analysts add value through data validation, metric choices and context-aware recommendations.", focus: ["Data quality and validation", "Metric design and interpretation", "Stakeholder communication"] },
    },
  },
  {
    title: "Business Intelligence Analyst",
    stage: "Recommended role · 12–18 months",
    summary: "Build dashboards and reporting systems that turn business data into decisions.",
    contribution: "Reliable dashboards can help teams track performance and make more productive decisions (8.2). Developing data modelling and reporting skills builds capabilities relevant to employment (4.4).",
    goals: [
      { number: "4.3", ...goalInfo["4.3"], reason: "Making BI skills and role requirements visible can help learners plan relevant technical learning; this demo does not provide or measure training access." },
      { number: "8.2", ...goalInfo["8.2"], reason: "Good reporting helps organisations monitor work, spot changes and use resources more effectively." },
      { number: "4.4", ...goalInfo["4.4"], reason: "The role uses technical and analytical skills that can be built through focused learning and portfolio work." },
      { number: "8.5", ...goalInfo["8.5"], reason: "A portfolio and clear skill pathway can support access to productive work, while job conditions depend on employers." },
    ],
    skills: [
      { name: "SQL", goals: ["4.4"], reason: "Provides a foundation for accessing and preparing the data used in reports." },
      { name: "Dashboard storytelling", goals: ["8.2"], reason: "Makes performance patterns clear enough to inform business decisions." },
      { name: "Business reporting", goals: ["8.2"], reason: "Supports teams in monitoring outcomes and identifying areas to improve." },
      { name: "Data modelling", goals: ["4.4", "8.2"], reason: "Builds technical capability and helps produce consistent, reusable reporting." },
    ],
    taskShift: { routine: "dashboard drafts, routine report refreshes and first-pass commentary", human: "trusted metric definitions, access controls and decision-focused dashboard design", signals: { moderate: "BI postings mention AI-assisted dashboard building alongside data modelling.", fast: "More teams adopt natural-language self-serve reporting for routine questions." } },
    scenarios: {
      moderate: { title: "AI speeds up dashboard creation", body: "AI assists with chart suggestions and draft explanations. BI analysts still define trusted metrics, check data models and make dashboards useful for their audience.", focus: ["Metric definitions and data modelling", "Dashboard design for decisions", "Quality checks and governance"] },
      fast: { title: "Self-service reporting expands", body: "More users create basic reports through natural language tools. BI specialists focus on trusted data foundations, access controls and consistent measures across teams.", focus: ["Semantic models and metric governance", "Data quality and access controls", "Advanced decision support"] },
    },
  },
  {
    title: "Machine Learning Intern",
    stage: "Recommended role · 0–12 months",
    summary: "Support modelling, experimentation and evaluation in applied machine learning work.",
    contribution: "Machine learning can support technological upgrading and innovation when it solves a real problem (8.2). Statistics, Python and evaluation skills build technical capabilities for employment (4.4).",
    goals: [
      { number: "4.3", ...goalInfo["4.3"], reason: "Showing machine learning skills can help learners identify relevant technical study; this demo does not provide or measure access to training." },
      { number: "8.2", ...goalInfo["8.2"], reason: "Well-tested models can help organisations improve products or processes through innovation." },
      { number: "4.4", ...goalInfo["4.4"], reason: "The path develops technical and analytical skills relevant to data and AI work." },
      { number: "8.5", ...goalInfo["8.5"], reason: "Internship experience can be a route into productive work, though access and job quality vary." },
    ],
    skills: [
      { name: "Python", goals: ["4.4"], reason: "A core practical programming skill for data and machine learning workflows." },
      { name: "Statistics", goals: ["4.4"], reason: "Builds quantitative capability for interpreting experiments and model results." },
      { name: "Model evaluation", goals: ["8.2"], reason: "Checks whether a model works reliably enough to support a real use case." },
      { name: "Feature engineering", goals: ["8.2"], reason: "Shapes input data so modelling can address a practical problem more effectively." },
    ],
    taskShift: { routine: "boilerplate code, initial feature search and baseline model comparisons", human: "problem framing, leakage-safe evaluation and interpreting model failures", signals: { moderate: "Intern roles expect candidates to verify AI-assisted code and model outputs.", fast: "Automated modelling tools handle more baseline searches with less manual setup." } },
    scenarios: {
      moderate: { title: "AI copilots assist model development", body: "AI helps write boilerplate code and explore candidate features. Interns still need to understand data, compare baselines and explain evaluation results.", focus: ["Statistics and experiment design", "Data leakage and evaluation checks", "Clear documentation"] },
      fast: { title: "Standard modelling workflows become easier to automate", body: "Tools automate more of the first-pass feature and model search. Human contribution shifts toward choosing the right problem, spotting weak evidence and checking models in context.", focus: ["Problem framing and domain context", "Robust evaluation and error analysis", "Responsible use and documentation"] },
    },
  },
  {
    title: "Product Analyst",
    stage: "Recommended role · 12–24 months",
    summary: "Use user behaviour, product metrics and experiments to guide product decisions.",
    contribution: "Product analysis can help teams improve how products work and allocate effort based on evidence (8.2). Building SQL and experiment skills supports job-relevant capabilities (4.4).",
    goals: [
      { number: "4.3", ...goalInfo["4.3"], reason: "Making product analytics skills visible can help learners plan relevant technical learning; this demo does not provide or measure training access." },
      { number: "8.2", ...goalInfo["8.2"], reason: "Funnel and experiment analysis can help product teams improve effectiveness and innovation." },
      { number: "4.4", ...goalInfo["4.4"], reason: "The role develops applied analytical skills that are useful across digital product work." },
      { number: "8.5", ...goalInfo["8.5"], reason: "A clear pathway can help learners prepare for productive work, without promising a specific job outcome." },
    ],
    skills: [
      { name: "Product metrics", goals: ["8.2"], reason: "Helps teams understand whether product changes improve user and business outcomes." },
      { name: "Experiment analysis", goals: ["4.4", "8.2"], reason: "Builds quantitative skills and tests whether proposed changes work." },
      { name: "SQL", goals: ["4.4"], reason: "Enables direct analysis of product events and user journeys." },
      { name: "User behaviour analysis", goals: ["8.2"], reason: "Connects product choices with how people actually use a service." },
    ],
    taskShift: { routine: "funnel queries, experiment summaries and routine usage-pattern analysis", human: "choosing meaningful experiments, understanding user needs and prioritising product problems", signals: { moderate: "Product analytics tools add AI summaries for funnels and experiment readouts.", fast: "Non-analyst teams use natural-language tools to answer routine product questions." } },
    scenarios: {
      moderate: { title: "AI speeds up product insight summaries", body: "AI helps explore funnels and draft experiment readouts. Product analysts still check assumptions, define meaningful success measures and connect findings to user needs.", focus: ["Experiment design and interpretation", "Product judgement", "User-centred communication"] },
      fast: { title: "Basic product questions become self-service", body: "AI tools answer more routine questions about usage patterns. Analysts focus on causal evidence, experiment quality and helping teams decide which problems deserve attention.", focus: ["Causal reasoning and experiment quality", "Product strategy and prioritisation", "Qualitative and quantitative evidence"] },
    },
  },
  {
    title: "Data Scientist",
    stage: "Future role · 3–5 years",
    summary: "Build models and experiments to solve complex business or product problems.",
    contribution: "Carefully evaluated modelling can support innovation and productivity (8.2). The path builds advanced statistical and computing capabilities for employment (4.4).",
    goals: [
      { number: "4.3", ...goalInfo["4.3"], reason: "Showing the role's statistical and computing requirements can help learners identify relevant advanced study; this demo does not measure access to it." },
      { number: "8.2", ...goalInfo["8.2"], reason: "Modelling and experiments can support technological upgrading when they improve real decisions or services." },
      { number: "4.4", ...goalInfo["4.4"], reason: "The role requires advanced technical skills that can be developed through education and applied projects." },
    ],
    skills: [
      { name: "Machine learning", goals: ["8.2"], reason: "Applies computational methods to find patterns and support new solutions." },
      { name: "Statistics", goals: ["4.4"], reason: "Builds the technical foundation needed to judge evidence and uncertainty." },
      { name: "Python", goals: ["4.4"], reason: "Provides practical computing skills for analysing data and developing models." },
      { name: "Causal thinking", goals: ["8.2"], reason: "Helps distinguish correlation from changes that may improve real outcomes." },
    ],
    taskShift: { routine: "baseline models, routine code and first-pass exploratory analysis", human: "causal reasoning, domain-specific questions and deciding whether evidence supports action", signals: { moderate: "Data science teams use copilots for coding and exploratory analysis.", fast: "AutoML systems handle more standard predictive modelling workflows." } },
    scenarios: {
      moderate: { title: "AI helps with coding and exploration", body: "AI accelerates routine coding and initial analysis. Data scientists focus on model choices, experimental design, limitations and explaining trade-offs.", focus: ["Causal reasoning and experiment design", "Model evaluation and interpretation", "Domain communication"] },
      fast: { title: "Standard models and analyses are more automated", body: "Automated tools produce more baseline analyses. Data scientists add value by framing high-impact questions, testing assumptions and deciding whether evidence is strong enough to act on.", focus: ["Problem framing and causal inference", "Robust validation and monitoring", "Ethics and domain expertise"] },
    },
  },
  {
    title: "Machine Learning Engineer",
    stage: "Future role · 3–5 years",
    summary: "Turn machine learning models into reliable production systems and deployment pipelines.",
    contribution: "Production ML can help organisations upgrade technology and deliver innovations at scale (8.2). Software and cloud skills develop technical capabilities relevant to digital employment (4.4).",
    goals: [
      { number: "4.3", ...goalInfo["4.3"], reason: "Making software and deployment skills visible can help learners plan technical study; this demo does not provide or measure training access." },
      { number: "8.2", ...goalInfo["8.2"], reason: "Reliable ML infrastructure can help organisations apply technology to products and operations." },
      { number: "4.4", ...goalInfo["4.4"], reason: "The path builds software engineering and deployment skills for work in a digital economy." },
    ],
    skills: [
      { name: "Python engineering", goals: ["4.4"], reason: "Develops software skills for building maintainable data and ML applications." },
      { name: "MLOps", goals: ["8.2"], reason: "Supports reliable deployment, monitoring and improvement of ML systems." },
      { name: "APIs", goals: ["4.4", "8.2"], reason: "Connects model capabilities with products and services in usable ways." },
      { name: "Cloud deployment", goals: ["8.2"], reason: "Provides infrastructure skills to operate technology beyond a local experiment." },
    ],
    taskShift: { routine: "integration scaffolding, test drafts and standard deployment configuration", human: "system architecture, security, reliability and operational accountability", signals: { moderate: "Engineering teams adopt AI code and test assistants in production workflows.", fast: "Platforms automate more of model packaging and deployment setup." } },
    scenarios: {
      moderate: { title: "AI assists coding and testing", body: "AI helps draft code and tests. Engineers remain responsible for deployment architecture, security, reliability and monitoring model behaviour.", focus: ["System design and reliability", "Security and testing", "Model monitoring"] },
      fast: { title: "More implementation work is automated", body: "Tools generate more integration code and deployment configurations. Engineers focus on architecture, production risk, cost and operational accountability.", focus: ["Architecture and platform judgement", "Security, reliability and cost", "Human oversight of model behaviour"] },
    },
  },
  {
    title: "AI Engineer",
    stage: "Future role · 3–5 years",
    summary: "Build AI-assisted products and workflows by integrating models into useful applications.",
    contribution: "Applied AI can support technological innovation and productivity when it improves a product or workflow responsibly (8.2). Learning AI, evaluation and integration builds emerging technical skills (4.4).",
    goals: [
      { number: "4.3", ...goalInfo["4.3"], reason: "Showing AI skills can help learners identify relevant technical study; this demo does not provide or measure access to training." },
      { number: "8.2", ...goalInfo["8.2"], reason: "Useful AI applications can contribute to innovation and productivity when they solve a genuine need." },
      { number: "4.4", ...goalInfo["4.4"], reason: "The pathway combines programming, evaluation and product skills relevant to employment." },
      { number: "8.5", ...goalInfo["8.5"], reason: "The pathway can prepare learners for emerging work, while job availability and conditions remain uncertain." },
    ],
    skills: [
      { name: "LLM workflows", goals: ["4.4"], reason: "Builds practical capability to integrate language models into applications." },
      { name: "Prompt evaluation", goals: ["8.2"], reason: "Checks whether model outputs meet the product's needs and quality expectations." },
      { name: "APIs", goals: ["4.4", "8.2"], reason: "Connects model services with software products and workflows." },
      { name: "Product judgement", goals: ["8.2"], reason: "Keeps AI features focused on useful outcomes rather than novelty alone." },
    ],
    taskShift: { routine: "prototype code, standard model integrations and first-pass test cases", human: "evaluation, system design, user value and responsible deployment", signals: { moderate: "AI copilots make prototype integrations quicker across product teams.", fast: "Common AI features become one-click integrations in mainstream platforms." } },
    scenarios: {
      moderate: { title: "AI copilots make prototyping faster", body: "Engineers use AI tools to assemble prototypes and integrations more quickly. Evaluation, product judgement and safe deployment distinguish useful applications.", focus: ["Prompt and system evaluation", "APIs and integration", "User-centred product judgement"] },
      fast: { title: "Basic AI integrations are widely automated", body: "Common AI features become simpler to assemble. Engineers focus more on system design, evaluation, governance, data flows and features that create durable user value.", focus: ["Evaluation and responsible AI", "System integration and data flows", "Differentiated product design"] },
    },
  },
];

function GoalTag({ number }: { number: string }) {
  const goalNumber = number.split(".")[0];
  return <span className="goal-tag"><img src={sdgIconUrl(goalNumber)} alt={`SDG ${goalNumber} icon`} />SDG {number}</span>;
}

function RolePicker({ selectedPath, onSelect }: { selectedPath: string; onSelect: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, careers.findIndex((item) => item.title === selectedPath));

  function showMenu() {
    setActiveIndex(selectedIndex);
    setOpen(true);
    requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
  }

  function chooseRole(title: string) {
    onSelect(title);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = (index + (event.key === "ArrowDown" ? 1 : -1) + careers.length) % careers.length;
      setActiveIndex(next);
      optionRefs.current[next]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : careers.length - 1;
      setActiveIndex(next);
      optionRefs.current[next]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div className="role-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      <div className="picker-heading"><label htmlFor="career-path">Explore a next-step role</label><span>PATH SELECTOR</span></div>
      <div className={`select-shell ${open ? "menu-open" : ""}`}>
        <button ref={triggerRef} id="career-path" type="button" className="role-trigger" aria-haspopup="listbox" aria-expanded={open} aria-controls="career-role-list" onClick={() => open ? setOpen(false) : showMenu()} onKeyDown={(event) => { if (event.key === "ArrowDown" && !open) { event.preventDefault(); showMenu(); } }}>
          <span>{selectedPath || "Choose a career role to begin"}</span><span className="role-trigger-meta">{selectedPath ? careers[selectedIndex].stage.split(" Â· ")[0] : "SELECT TO BEGIN"}</span><span className="select-chevron" aria-hidden="true" />
        </button>
        {open && <div className="role-menu" id="career-role-list" role="listbox" aria-label="Choose a career role">
          {careers.map((item, index) => <button ref={(node) => { optionRefs.current[index] = node; }} type="button" role="option" aria-selected={item.title === selectedPath} className={`role-option ${item.title === selectedPath ? "current" : ""} ${index === activeIndex ? "focused" : ""}`} key={item.title} onClick={() => chooseRole(item.title)} onKeyDown={(event) => handleOptionKeyDown(event, index)}>
            <span className="role-option-copy"><strong>{item.title}</strong><small>{item.summary}</small></span>
            <span className="role-option-stage">{item.stage.split(" Â· ")[0]}</span>
            {item.title === selectedPath && <span className="role-option-check" aria-hidden="true">✓</span>}
          </button>)}
        </div>}
      </div>
      <p className="picker-hint">Choose a path to update its SDG map and future scenarios.</p>
    </div>
  );
}

export default function Home() {
  const [selectedPath, setSelectedPath] = useState("");
  const [hasChosenPath, setHasChosenPath] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [selectedSdg, setSelectedSdg] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [scenario, setScenario] = useState<Scenario>("moderate");
  const [major, setMajor] = useState("data_science");
  const [interests, setInterests] = useState<string[]>(["analytics", "ai", "business"]);
  const [profileSkills, setProfileSkills] = useState<string[]>(["python", "sql", "statistics"]);
  const [experienceMonths, setExperienceMonths] = useState(6);
  const [demoProfile, setDemoProfile] = useState<DemoProfile | null>(null);
  const [modelResult, setModelResult] = useState<CareerModelResult | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState("");
  const [sdgExplanations, setSdgExplanations] = useState<Record<string, SDGExplanation> | null>(null);
  const [sdgExplanationLoading, setSdgExplanationLoading] = useState(false);
  const [sdgExplanationError, setSdgExplanationError] = useState("");
  const [sdgOverview, setSdgOverview] = useState<SDGOverview | null>(null);
  const [sdgOverviewLoading, setSdgOverviewLoading] = useState(false);
  const [sdgOverviewError, setSdgOverviewError] = useState("");
  const [sdgRecommendation, setSdgRecommendation] = useState<SDGRecommendation | null>(null);
  const [sdgRecommendationLoading, setSdgRecommendationLoading] = useState(false);
  const [sdgRecommendationError, setSdgRecommendationError] = useState("");
  const path = careers.find((item) => item.title === selectedPath) ?? careers[0];
  const currentOutlook = path.scenarios[scenario];
  const rankedGroups = sdgRecommendation?.ranked_sdgs ?? [];
  const currentGroup = rankedGroups.find((item) => item.number === selectedSdg);
  const datasetSkillMap = sdgRecommendation?.role === path.title
    ? new Map(sdgRecommendation.skill_mappings.map((item) => [item.name, item.goals]))
    : null;
  const pathSkills = path.skills.map((skill) => ({ ...skill, goals: datasetSkillMap?.get(skill.name) ?? [] }));
  const targetSkills = selectedTargets.length ? pathSkills.filter((skill) => selectedTargets.some((code) => skill.goals.includes(code))) : [];
  useEffect(() => {
    const controller = new AbortController();
    let query = "sample_id=cs-student";
    try {
      const saved = localStorage.getItem("aiversecity.synthetic-profile-id");
      const sample = localStorage.getItem("pathwaay.sample-id") || "cs-student";
      query = saved && localStorage.getItem("pathwaay.profile-mode") === "saved"
        ? `profile_id=${encodeURIComponent(saved)}` : `sample_id=${encodeURIComponent(sample)}`;
    } catch { /* Use the premade profile when browser storage is unavailable. */ }
    fetch(`/api/trends/experience?${query}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ profile: DemoProfile }> : Promise.reject(new Error("Profile unavailable")))
      .then(({ profile }) => {
        setDemoProfile(profile);
        const field = profile.field_of_study.toLowerCase();
        setMajor(field.includes("computer science") ? "computer_science" : field.includes("data science") ? "data_science" : field.includes("business") ? "business" : field.includes("economics") ? "economics" : field.includes("engineering") ? "engineering" : "other");
        const text = `${profile.interests.join(" ")} ${profile.aspiration}`.toLowerCase();
        setInterests(interestOptions.filter((item) => item === "ai" ? text.includes("artificial intelligence") || /\bai\b/.test(text) : item === "analytics" ? text.includes("data") || text.includes("analytic") : text.includes(item)));
        const available = new Set(profile.skills.map((skill) => skill.id));
        setProfileSkills(skillOptions.filter((item) => item === "python" ? available.has("local:python-programming") : item === "machine_learning" ? available.has("local:machine-learning") : false));
        const months = profile.years_experience * 12;
        setExperienceMonths([0, 6, 24, 60].reduce((closest, option) => Math.abs(months - option) < Math.abs(months - closest) ? option : closest, 0));
      })
      .catch(() => { if (!controller.signal.aborted) setDemoProfile(null); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!hasChosenPath) return;
    const controller = new AbortController();
    setSdgRecommendation(null);
    setSdgRecommendationError("");
    setSdgRecommendationLoading(true);
    fetch("/api/sdg/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ role: path.title }),
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(response.status === 404
          ? "The FastAPI server is out of date. Restart it from the project root to load the SDG routes."
          : body.detail || "Could not rank the SDGs from the mapping dataset.");
      }
      const result = await response.json() as SDGRecommendation;
      setSdgRecommendation(result);
      setSelectedSdg((current) => current ?? result.recommended_sdg);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setSdgRecommendationError(error instanceof Error ? error.message : "SDG ranking is unavailable.");
    }).finally(() => {
      if (!controller.signal.aborted) setSdgRecommendationLoading(false);
    });
    return () => controller.abort();
  }, [hasChosenPath, path]);

  useEffect(() => {
    if (!selectedSdg) {
      setSdgOverview(null);
      setSdgOverviewError("");
      setSdgOverviewLoading(false);
      return;
    }
    const controller = new AbortController();
    setSdgOverview(null);
    setSdgOverviewError("");
    setSdgOverviewLoading(true);
    fetch("/api/sdg/overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        role: path.title,
        role_summary: path.summary,
        sdg_number: selectedSdg,
        targets: currentGroup?.targets ?? [],
        skills: pathSkills.map(({ name, goals }) => ({ name, goals })),
      }),
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(response.status === 404
          ? "The FastAPI server is out of date. Restart it from the project root to load the SDG routes."
          : body.detail || "Could not generate this SDG overview.");
      }
      setSdgOverview(await response.json() as SDGOverview);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setSdgOverviewError(error instanceof Error ? error.message : "SDG overview is unavailable.");
    }).finally(() => {
      if (!controller.signal.aborted) setSdgOverviewLoading(false);
    });
    return () => controller.abort();
  }, [selectedSdg, path, sdgRecommendation]);

  useEffect(() => {
    if (!selectedTargets.length) {
      setSdgExplanations(null);
      setSdgExplanationError("");
      setSdgExplanationLoading(false);
      return;
    }
    const controller = new AbortController();
    setSdgExplanations(null);
    setSdgExplanationError("");
    setSdgExplanationLoading(true);
    Promise.all(selectedTargets.map(async (targetCode) => {
      const targetInfo = currentGroup?.targets.find((target) => target.code === targetCode);
      if (!targetInfo) return null;
      const response = await fetch("/api/sdg/explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          role: path.title,
          role_summary: path.summary,
          target_code: targetCode,
          target_title: targetInfo.title,
          target_definition: targetInfo.definition,
          skills: pathSkills.map(({ name, goals }) => ({ name, goals })),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(response.status === 404
          ? "The FastAPI server is out of date. Restart it from the project root to load the SDG routes."
          : body.detail || "Could not generate this SDG explanation.");
      }
      return [targetCode, await response.json() as SDGExplanation] as const;
    })).then((results) => {
      setSdgExplanations(Object.fromEntries(results.filter((result): result is NonNullable<typeof result> => result !== null)));
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setSdgExplanationError(error instanceof Error ? error.message : "SDG explanation is unavailable.");
    }).finally(() => {
      if (!controller.signal.aborted) setSdgExplanationLoading(false);
    });
    return () => controller.abort();
  }, [selectedTargets, path, sdgRecommendation, selectedSdg]);

  useEffect(() => {
    const updateScrollState = () => setHasScrolled(window.scrollY > 8);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  function choosePath(title: string) {
    setSelectedPath(title);
    setHasChosenPath(true);
    setSelectedSdg(null);
    setSelectedTargets([]);
    setSdgRecommendation(null);
    setScenario("moderate");
  }

  function toggleTarget(targetCode: string) {
    setSelectedTargets((current) => current.includes(targetCode)
      ? current.filter((code) => code !== targetCode)
      : current.length < 2 ? [...current, targetCode] : current);
  }

  async function runCareerModel() {
    setModelLoading(true);
    setModelError("");
    try {
      const response = await fetch("/api/career/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ major, interests, skills: profileSkills, experience_months: experienceMonths }),
      });
      if (!response.ok) throw new Error("The career model could not respond. Start the FastAPI backend and try again.");
      setModelResult(await response.json() as CareerModelResult);
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "Career model unavailable.");
    } finally {
      setModelLoading(false);
    }
  }

  return (
    <main className="shell" onPointerMove={(event) => {
      event.currentTarget.style.setProperty("--pointer-x", `${event.clientX}px`);
      event.currentTarget.style.setProperty("--pointer-y", `${event.clientY}px`);
    }}>
      <div className="ambient-layer" aria-hidden="true" />
      <WorkspaceNav active="explorer" scrolled={hasScrolled} />

      <section className="hero" id="top">
        <span className="orbit-system" aria-hidden="true">
          <span className="orbit-core" />
          <span className="orbit-track orbit-track-one"><span className="orbit-satellite" /></span>
          <span className="orbit-track orbit-track-two"><span className="orbit-satellite satellite-two" /></span>
        </span>
        <p className="eyebrow">CAREER PATHWAYS · SKILLS · SUSTAINABLE DEVELOPMENT</p>
        <h1>Build skills for<br /><span>a changing future.</span></h1>
        <p className="intro">Explore how analytics and AI careers can contribute to the Sustainable Development Goals, then compare two possible AI futures and the skills each may call for.</p>
      </section>

      <section className="explorer card" aria-labelledby="path-heading">
        <div className="section-heading">
          <div><p className="eyebrow">01 / YOUR CAREER PATH</p><h2 id="path-heading">Start from your profile</h2></div>
          <span className="step-number">01</span>
        </div>
        <div className="profile-note"><span className="profile-dot" /> DEMO PROFILE <strong>{demoProfile?.label ?? "Loading profile"}</strong><span>{demoProfile?.aspiration ?? "The premade profile will set the starting inputs when loaded."}</span></div>
        <section className="model-panel" aria-labelledby="model-heading">
          <div className="model-heading"><div><p className="eyebrow">SYNTHETIC SIGNAL MODEL</p><h3 id="model-heading">Find roles that fit your starting point</h3></div><span className="model-status">CPU INFERENCE</span></div>
          <div className="model-fields">
            <label className="model-field">Study area<select value={major} onChange={(event) => setMajor(event.target.value)}><option value="data_science">Data science</option><option value="computer_science">Computer science</option><option value="business">Business</option><option value="economics">Economics</option><option value="engineering">Engineering</option><option value="other">Other</option></select></label>
            <label className="model-field">Experience<select value={experienceMonths} onChange={(event) => setExperienceMonths(Number(event.target.value))}><option value={0}>Just starting</option><option value={6}>Early projects</option><option value={24}>1–3 years</option><option value={60}>3+ years</option></select></label>
          </div>
          <div className="model-chip-group"><span>Interests</span><div>{interestOptions.map((item) => <button type="button" key={item} className={`model-chip ${interests.includes(item) ? "active" : ""}`} aria-pressed={interests.includes(item)} onClick={() => setInterests((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])}>{item.replaceAll("_", " ")}</button>)}</div></div>
          <div className="model-chip-group"><span>Skills you have tried</span><div>{skillOptions.map((item) => <button type="button" key={item} className={`model-chip ${profileSkills.includes(item) ? "active" : ""}`} aria-pressed={profileSkills.includes(item)} onClick={() => setProfileSkills((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])}>{item.replaceAll("_", " ")}</button>)}</div></div>
          <button type="button" className="model-run" disabled={modelLoading || interests.length === 0} onClick={runCareerModel}>{modelLoading ? "Reading the signal…" : modelResult ? "Refresh role matches" : "Generate role matches"}<span>→</span></button>
          {modelError && <p className="model-error" role="alert">{modelError}</p>}
          {modelResult && <div className="model-results staged-reveal" aria-live="polite">
            <div className="model-results-title"><div><span className="small-label">MODEL RANKING · SYNTHETIC FIT SCORES</span><p>Choose a role to open its SDG map and career scenarios.</p></div><span className="model-tag">{modelResult.model}</span></div>
            <div className="model-ranking">{modelResult.recommendations.slice(0, 3).map((item, index) => <button type="button" key={item.role} className={`model-match ${selectedPath === item.role ? "selected" : ""}`} onClick={() => choosePath(item.role)}><span className="model-rank">0{index + 1}</span><span className="model-match-copy"><strong>{item.role}</strong><small>Skill signals: {item.skills.slice(0, 3).join(" · ")}</small></span><span className="model-score">{item.score.toFixed(0)}<small>FIT</small></span></button>)}</div>
            <div className="model-outlooks">{(["moderate", "fast"] as Scenario[]).map((key) => <div key={key}><span>{key === "moderate" ? "MODERATE" : "FAST"} · 2030 SKILL SIGNAL</span><p>{modelResult.scenario_estimates[key]?.[0]?.skills.slice(0, 3).map((item) => `${item.skill} ${item.demand_index}`).join(" · ")}</p></div>)}</div>
            <p className="model-disclaimer">{modelResult.data_notice} Scores describe similarity to simulated profiles, not a probability of employment.</p>
          </div>}
        </section>
        <RolePicker selectedPath={selectedPath} onSelect={choosePath} />
        {hasChosenPath && <div className="path-summary staged-reveal">
          <div className="path-icon" aria-hidden="true">↗</div>
          <div><span className="stage-label">{path.stage}</span><h3>{path.title}</h3><p>{path.summary}</p></div>
        </div>}
      </section>

      {hasChosenPath && <section className="impact-section staged-reveal" aria-labelledby="impact-heading">
        <div className="section-heading">
          <div><p className="eyebrow">02 / PURPOSE IN PRACTICE</p><h2 id="impact-heading">How this path connects to the SDGs</h2></div>
          <span className="section-caption">THE 2030 AGENDA</span>
        </div>
        <p className="section-intro">The dataset compares this role with all 17 Sustainable Development Goals, then surfaces the two strongest skill connections. Open a target to explore a possible contribution.</p>
        <div className="sdg-dashboard">
          <div className="dashboard-label"><span className="small-label">{sdgRecommendationLoading ? "1 · RANKING MAPPED GOALS ACROSS ALL 17 SDGS" : sdgRecommendation ? "1 · TOP TWO · BEST FIT: SDG " + sdgRecommendation.recommended_sdg : "1 · SDG ROLE MATCH"}</span><span className="selection-hint">Viewing: {path.title}</span></div>
          <div className="goal-grid">
            {rankedGroups.map((group) => {
              const isBestFit = sdgRecommendation?.recommended_sdg === group.number;
              return <button type="button" key={group.number} disabled={!sdgRecommendation} className={"goal-card goal-select " + (selectedSdg === group.number ? "selected" : "")} aria-pressed={selectedSdg === group.number} onClick={() => { setSelectedSdg(group.number); setSelectedTargets([]); }}>
                <img className="sdg-icon" src={group.icon_url} alt={"Official UN Sustainable Development Goal " + group.number + ": " + group.title} loading="lazy" />
                <div className="goal-copy"><span className="small-label">SUSTAINABLE DEVELOPMENT GOAL {group.number}</span><h3>{group.title}</h3><p>{selectedSdg === group.number ? (sdgOverviewLoading ? "Building a role-specific explanation…" : sdgOverview?.main_contribution ?? (sdgOverviewError ? "Overview unavailable: " + sdgOverviewError : group.summary)) : group.mapped_skill_count + " role skills have mapped links to " + group.target_codes.join(" and ") + "."}</p><span className="goal-fit-label">{isBestFit ? "BEST FIT" : "SECOND FIT"} · RELATIVE MATCH {group.relative_fit}%</span></div>
                <span className="goal-chevron" aria-hidden="true">{selectedSdg === group.number ? "●" : "○"}</span>
              </button>;
            })}
          </div>
          {sdgRecommendationError && <p className="model-error" role="alert">{sdgRecommendationError}</p>}
          {sdgRecommendationLoading && <p className="step-prompt">Comparing mapped role skills with the full SDG catalog…</p>}
          {sdgRecommendation && rankedGroups.length < 2 && <p className="step-prompt">The mapping dataset found only one goal with supported skill links for this role.</p>}
          {sdgRecommendation && <p className="sdg-data-note">{sdgRecommendation.data_notice}</p>}
          <p className="sdg-asset-note">Official SDG icons from the <a href="https://sdgs.un.org/goals" target="_blank" rel="noreferrer">United Nations</a>. The content of this publication has not been approved by the United Nations and does not reflect the views of the United Nations or its officials or Member States.</p>

          {currentGroup ? <div key={selectedSdg} className="target-dashboard staged-reveal">
            <div className="dashboard-label"><span className="small-label">2 · CHOOSE UP TO TWO TARGETS</span><span className="selection-hint">{selectedTargets.length} / 2 selected · SDG {selectedSdg} · {currentGroup.title}</span></div>
            <div className={"target-choices" + (currentGroup.targets.length === 1 ? " target-choices-single" : "")} role="group" aria-label={"Choose a target under SDG " + selectedSdg}>
              {currentGroup.targets.map((target, index) => <button type="button" key={target.code} className={"target-choice target-choice-reveal target-choice-" + (index + 1) + (selectedTargets.includes(target.code) ? " active" : "")} aria-pressed={selectedTargets.includes(target.code)} disabled={selectedTargets.length >= 2 && !selectedTargets.includes(target.code)} onClick={() => toggleTarget(target.code)}><span className="target-choice-code">{target.code}</span><span className="target-choice-copy"><strong>{target.title}</strong><small>{sdgOverviewLoading ? "Preparing role-specific connection…" : sdgOverview?.target_previews.find((item) => item.code === target.code)?.explanation ?? (sdgOverviewError ? "Preview unavailable." : "")}</small></span></button>)}
            </div>
            {selectedTargets.length ? selectedTargets.map((targetCode) => {
              const targetInfo = currentGroup.targets.find((target) => target.code === targetCode);
              const explanation = sdgExplanations?.[targetCode];
              const matchingSkills = pathSkills.filter((skill) => skill.goals.includes(targetCode));
              return targetInfo ? <article className="target-detail" key={targetCode} aria-live="polite">
                <div className="target-detail-heading"><div className="sdg-number sdg-target">{targetCode}<span>TARGET</span></div><div><span className="small-label">SDG {selectedSdg} · {currentGroup.title}</span><h3>{targetInfo.title}</h3><p>{targetInfo.definition}</p></div></div>
                <div className="target-impact"><div><span className="small-label">HOW {path.title.toUpperCase()} CONNECTS</span><p>{sdgExplanationLoading ? "Preparing a role-specific explanation…" : explanation?.role_contribution ?? (sdgExplanationError ? "Explanation unavailable: " + sdgExplanationError : "")}</p></div><div className="coverage"><strong>{matchingSkills.length} / {pathSkills.length}</strong><span>skills linked directly<br />to this target</span></div></div>
              </article> : null;
            }) : <p className="step-prompt">Choose one or two targets to open their role contributions and matching skills.</p>}
          </div> : <div className="sdg-prompt"><span className="prompt-arrow">↓</span><div><strong>Choose one of the two best-fit SDGs to begin</strong><span>The selected goal’s target and career connection will appear here.</span></div></div>}
        </div>
        {selectedTargets.length > 0 && <div className="skills-panel">
          <div className="skills-heading"><div><p className="eyebrow">SKILLS THAT CREATE THE LINK</p><h3>Role skills and their SDGs</h3></div><span className="small-label">{pathSkills.length} SKILLS MAPPED · {targetSkills.length} MATCH SELECTED TARGETS</span></div>
          <div className="skill-list">
            {pathSkills.map((skill, index) => <article className={`skill-row ${selectedTargets.some((code) => skill.goals.includes(code)) ? "skill-row-match" : ""}`} key={skill.name}>
              <span className="skill-index">0{index + 1}</span>
              <div className="skill-copy"><h4>{skill.name}</h4><p>{sdgExplanationLoading ? "Preparing this skill’s target connections…" : selectedTargets.map((code) => sdgExplanations?.[code]?.skill_links.find((item) => item.skill === skill.name)?.explanation).filter(Boolean).join(" ") || (sdgExplanationError ? "Could not generate a target-specific explanation for this skill." : "")}</p></div>
              <div className="skill-tags">{skill.goals.map((goal) => <GoalTag key={goal} number={goal} />)}</div>
            </article>)}
          </div>
        </div>}
      </section>}

      {hasChosenPath && selectedTargets.length > 0 && <section className="scenario-section card staged-reveal" aria-labelledby="scenario-heading">
        <div className="section-heading">
          <div><p className="eyebrow">03 / PLAN FOR MORE THAN ONE FUTURE</p><h2 id="scenario-heading">Two futures. One career you can prepare for.</h2></div>
          <span className="step-number">03</span>
        </div>
        <div className="scenario-intro"><span className="scenario-orbit">↗</span><p>Same role, different adoption pace. Compare both futures, then select one to shape your skill plan.</p><span className="small-label">ROLE IN FOCUS · {path.title.toUpperCase()}</span></div>
        <div className="future-grid">
          {(["moderate", "fast"] as Scenario[]).map((key, index) => {
            const future = path.scenarios[key];
            const isSelected = scenario === key;
            return <article className={`future-card ${key} ${isSelected ? "selected" : ""}`} key={key}>
              <div className="future-card-top">
                <span className="future-index">FUTURE 0{index + 1}</span>
                <span className="scenario-kicker">{key === "moderate" ? "MODERATE DISRUPTION" : "FAST DISRUPTION"}</span>
              </div>
              <h3>{future.title}</h3>
              <p className="future-description">{future.body}</p>
              <div className="assumption-box"><span>SCENARIO ASSUMPTION</span><p>{key === "moderate" ? "AI adoption spreads gradually. It assists repeatable tasks while people review outputs and decisions." : "AI capabilities and adoption spread quickly. More routine tasks are automated across common workflows."}</p></div>
              <div className="future-lens">
                <div><span className="lens-label"><span className="lens-icon">◌</span> TASKS THAT MAY SHIFT</span><p>{key === "moderate" ? `AI assists with ${path.taskShift.routine}.` : `A larger share of ${path.taskShift.routine} may be automated.`}</p></div>
                <div><span className="lens-label"><span className="lens-icon">✳</span> HUMAN EDGE</span><p>{path.taskShift.human}.</p></div>
                <div><span className="lens-label"><span className="lens-icon">⌁</span> SIGNAL TO WATCH</span><p>{path.taskShift.signals[key]}</p></div>
              </div>
              <div className="future-focus"><span className="small-label">SKILL BETS IN THIS FUTURE</span><ul>{future.focus.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <button type="button" className="future-select" aria-pressed={isSelected} onClick={() => setScenario(key)}>{isSelected ? "✓  Planning lens selected" : "Use this future for my plan  →"}</button>
            </article>;
          })}
        </div>
        <div className="hedge-plan" aria-live="polite">
          <div className="hedge-intro"><p className="eyebrow">YOUR CAREER HEDGE</p><h3>Build a base. Then place a skill bet.</h3><p>Keep growing the foundations for {path.title}; add focused skills for the future you selected.</p><div className="foundation-skills">{path.skills.map((skill) => <span key={skill.name}>{skill.name}</span>)}</div></div>
          <div className="hedge-bet"><span className="small-label">EXTRA SKILL BET · {scenario === "moderate" ? "MODERATE" : "FAST"} FUTURE</span><ul>{currentOutlook.focus.map((item) => <li key={item}><span>↗</span>{item}</li>)}</ul></div>
        </div>
        <p className="estimate-note"><span aria-hidden="true">ⓘ</span> These are alternative scenario estimates, not predictions. Task shifts and signals are illustrative assumptions, not live forecasts. Watch actual job postings and employer practices to update the plan.</p>
      </section>}

      <footer className="footer"><span>PATHWAAY <span className="footer-dot">·</span> CAREER EXPLORER</span><span>Role and skill examples adapted from the CareerOS career-path simulator.</span></footer>
    </main>
  );
}
