"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";

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

const goalInfo: Record<string, { title: string; target: string }> = {
  "4.3": { title: "Quality Education", target: "Target 4.3 · Equal access to technical, vocational and tertiary education" },
  "4.4": { title: "Quality Education", target: "Target 4.4 · Build skills for employment and decent work" },
  "8.2": { title: "Decent Work and Economic Growth", target: "Target 8.2 · Raise productivity through technology and innovation" },
  "8.5": { title: "Decent Work and Economic Growth", target: "Target 8.5 · Support productive employment and decent work" },
};

const sdgGroups = [
  { number: "4", title: "Quality Education", description: "Skills, learning and preparation for work", targets: ["4.3", "4.4"] },
  { number: "8", title: "Decent Work and Economic Growth", description: "Productivity, innovation and decent employment", targets: ["8.2", "8.5"] },
];

const targetDescriptions: Record<string, string> = {
  "4.3": "Ensure equal access for women and men to affordable and quality technical, vocational and tertiary education, including university.",
  "4.4": "Increase the number of young people and adults with relevant skills, including technical and vocational skills, for employment, decent jobs and entrepreneurship.",
  "8.2": "Achieve higher levels of economic productivity through diversification, technological upgrading and innovation.",
  "8.5": "Achieve full and productive employment and decent work for all, including young people and persons with disabilities, with equal pay for work of equal value.",
};

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
  return <span className="goal-tag">SDG {number}</span>;
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
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario>("moderate");
  const path = careers.find((item) => item.title === selectedPath) ?? careers[0];
  const currentOutlook = path.scenarios[scenario];
  const currentGroup = sdgGroups.find((item) => item.number === selectedSdg);
  const targetContribution = path.goals.find((goal) => goal.number === selectedTarget);
  const targetSkills = selectedTarget ? path.skills.filter((skill) => skill.goals.includes(selectedTarget)) : [];

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
    setSelectedTarget(null);
    setScenario("moderate");
  }

  return (
    <main className="shell" onPointerMove={(event) => {
      event.currentTarget.style.setProperty("--pointer-x", `${event.clientX}px`);
      event.currentTarget.style.setProperty("--pointer-y", `${event.clientY}px`);
    }}>
      <div className="ambient-layer" aria-hidden="true" />
      <header className={`topbar ${hasScrolled ? "is-scrolled" : ""}`}>
        <a className="brand" href="#top" aria-label="Pathwaay home"><span className="brand-mark">P</span> Pathwaay <span className="brand-note">CAREER EXPLORER</span></a>
        <span className="demo-pill"><span /> DEMO EXPERIENCE</span>
      </header>

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
        <div className="profile-note"><span className="profile-dot" /> DEMO PROFILE <strong>Data Science Student</strong><span>Computer science foundations · analytics projects · early portfolio evidence</span></div>
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
        <p className="section-intro">Choose a main Sustainable Development Goal, then open one of its targets to see how this role and its skills connect. These are potential links, not proof that a role achieves a goal.</p>
        <div className="sdg-dashboard">
          <div className="dashboard-label"><span className="small-label">1 · CHOOSE A MAIN SDG</span><span className="selection-hint">Viewing: {path.title}</span></div>
          <div className="goal-grid">
            {sdgGroups.map((group) => <button type="button" key={group.number} className={`goal-card goal-select ${selectedSdg === group.number ? "selected" : ""}`} aria-pressed={selectedSdg === group.number} onClick={() => { setSelectedSdg(group.number); setSelectedTarget(null); }}>
              <div className={`sdg-number sdg-main-${group.number}`}>{group.number}<span>SDG</span></div>
              <div className="goal-copy"><span className="small-label">SUSTAINABLE DEVELOPMENT GOAL {group.number}</span><h3>{group.title}</h3><p>{group.description}</p></div>
              <span className="goal-chevron" aria-hidden="true">{selectedSdg === group.number ? "●" : "○"}</span>
            </button>)}
          </div>

          {currentGroup ? <div key={selectedSdg} className="target-dashboard staged-reveal">
            <div className="dashboard-label"><span className="small-label">2 · CHOOSE A TARGET</span><span className="selection-hint">SDG {selectedSdg} · {currentGroup.title}</span></div>
            <div className="target-choices" role="group" aria-label={`Choose a target under SDG ${selectedSdg}`}>
              {currentGroup.targets.map((target, index) => <button type="button" key={target} className={`target-choice target-choice-reveal target-choice-${index + 1} ${selectedTarget === target ? "active" : ""}`} aria-pressed={selectedTarget === target} onClick={() => setSelectedTarget(target)}>{target}<span>{target === "4.3" ? "Learning access" : target === "4.4" ? "Skills for work" : target === "8.2" ? "Productivity & innovation" : "Decent employment"}</span></button>)}
            </div>
            {selectedTarget ? <article className="target-detail" aria-live="polite">
              <div className="target-detail-heading"><div className={`sdg-number sdg-${selectedTarget.replace(".", "-")}`}>{selectedTarget}<span>TARGET</span></div><div><span className="small-label">SDG {selectedTarget} · {goalInfo[selectedTarget].title}</span><h3>{targetDescriptions[selectedTarget]}</h3></div></div>
              <div className="target-impact"><div><span className="small-label">HOW {path.title.toUpperCase()} CONNECTS</span><p>{targetContribution?.reason ?? "This is a potential connection through the role's skills and learning pathway."}</p></div><div className="coverage"><strong>{targetSkills.length} / {path.skills.length}</strong><span>skills linked directly<br />to this target</span></div></div>
              {targetSkills.length === 0 && <p className="mapping-note">This target focuses on access to learning. The demo maps the role pathway to it, but does not show training providers or measure access.</p>}
            </article> : <p className="step-prompt">Choose a target to open its role contribution and matching skills.</p>}
          </div> : <div className="sdg-prompt"><span className="prompt-arrow">↓</span><div><strong>Choose SDG 4 or SDG 8 to begin</strong><span>The selected goal’s targets and career connections will appear here.</span></div></div>}
        </div>
        {selectedTarget && <div className="skills-panel">
          <div className="skills-heading"><div><p className="eyebrow">SKILLS THAT CREATE THE LINK</p><h3>Role skills and their SDGs</h3></div><span className="small-label">{path.skills.length} SKILLS MAPPED · {targetSkills.length} MATCH SDG {selectedTarget}</span></div>
          <div className="skill-list">
            {path.skills.map((skill, index) => <article className={`skill-row ${skill.goals.includes(selectedTarget) ? "skill-row-match" : ""}`} key={skill.name}>
              <span className="skill-index">0{index + 1}</span>
              <div className="skill-copy"><h4>{skill.name}</h4><p>{skill.reason}</p></div>
              <div className="skill-tags">{skill.goals.map((goal) => <GoalTag key={goal} number={goal} />)}</div>
            </article>)}
          </div>
        </div>}
      </section>}

      {hasChosenPath && selectedTarget && <section className="scenario-section card staged-reveal" aria-labelledby="scenario-heading">
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
