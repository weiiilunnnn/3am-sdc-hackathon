"use client";

import Link from "next/link";
import CVFastTrack from "@/components/CVFastTrack";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { extractProfileSkills, getSkills, type SkillEvidenceInput, type SkillExtractionCandidate, type SkillOption } from "@/lib/api";
import { PATHWAAY_PROFILE_HANDOFF_KEY, type PathwaayRegistrationProfile } from "@/lib/pathwaay-profile";

const educationOptions = ["Secondary", "Certificate", "Diploma", "Bachelor’s degree", "Postgraduate", "Other"];
const learningModes = ["Self-paced", "Instructor-led", "Peer learning", "A mix of formats"];
const recommendedSkillNames = ["Python programming", "Data analysis", "Machine learning", "Communication", "Problem solving", "Critical thinking"];

type ChosenSkill = { id: string; name: string; source: string };
type JobExperience = { id: string; title: string; timeframe: string; company: string; description: string };

const demoExperience: JobExperience = {
  id: "demo-experience-1",
  title: "Data Analytics Intern",
  timeframe: "Jan 2025 – Apr 2025",
  company: "Aiversecity Demo Lab",
  description: "Cleaned fictional survey and campus energy datasets with Python programming and performed data analysis to find patterns. Built and tested a basic machine learning classifier to group records, then checked totals with spreadsheet analysis. Investigated missing values, used critical thinking to compare likely causes, and applied problem solving to resolve inconsistent records.",
};

function ParticleWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    let scale = 1;
    const dust = Array.from({ length: 180 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: .35 + Math.random() * .8,
      phase: Math.random() * Math.PI * 2,
    }));

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      scale = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      const drift = reducedMotion ? .35 : time * .00072;
      const columns = Math.ceil(width / 7);

      for (let column = 0; column < columns; column++) {
        const x = column * 7;
        const normalizedX = x / Math.max(width, 1);
        const signal = Math.sin(x * .018 + drift) + .42 * Math.sin(x * .044 - drift * 1.7);
        const envelope = .28 + .72 * Math.pow(Math.abs(Math.sin(x * .008 + drift * .38)), .6);
        const center = height * .53 + signal * 19;
        for (let layer = -6; layer <= 6; layer++) {
          const offset = layer * 6;
          const y = center + offset * (.72 + .2 * Math.sin(x * .013 + drift));
          const density = Math.exp(-(layer * layer) / 21) * envelope;
          const grain = .72 + .28 * Math.sin(column * 12.989 + layer * 78.233);
          context.globalAlpha = Math.max(0, density * grain * .7);
          context.fillStyle = normalizedX > .68 ? "#76e9dc" : "#76edb3";
          const radius = (.65 + .45 * grain) * (layer === 0 ? 1.2 : 1);
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }

      for (const particle of dust) {
        const x = ((particle.x * width + (reducedMotion ? 0 : time * .004)) % width + width) % width;
        const waveY = height * .53 + (Math.sin(x * .018 + drift) + .42 * Math.sin(x * .044 - drift * 1.7)) * 19;
        const y = particle.y * height * .8 + waveY * .2;
        context.globalAlpha = .12 + .16 * (Math.sin(time * .001 + particle.phase) + 1) / 2;
        context.fillStyle = "#9df7d0";
        context.beginPath();
        context.arc(x, y, particle.size, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
      if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    draw(performance.now());
    if (reducedMotion) return () => window.removeEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-wave" aria-hidden="true" />;
}

export default function RegisterPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [journeyTransition, setJourneyTransition] = useState(false);
  const [showRegisterIntro, setShowRegisterIntro] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [creationPhase, setCreationPhase] = useState(0);
  const [firstName, setFirstName] = useState("Alan");
  const [lastName, setLastName] = useState("Tan");
  const [email, setEmail] = useState("alantan@example.com");
  const [major, setMajor] = useState("Information Systems");
  const [university, setUniversity] = useState("Aiversecity Demo University");
  const [cgpa, setCgpa] = useState("3.65");
  const [schoolAwards, setSchoolAwards] = useState("Fictional campus showcase — team presentation commendation.");
  const [otherInterests, setOtherInterests] = useState("Sustainability, data storytelling, and community projects.");
  const [educationLevel, setEducationLevel] = useState("Bachelor’s degree");
  const [jobExperiences, setJobExperiences] = useState<JobExperience[]>([{ ...demoExperience }]);
  const [skillQuery, setSkillQuery] = useState("");
  const [skillOptions, setSkillOptions] = useState<SkillOption[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<ChosenSkill[]>([
    { id: "local:python-programming", name: "Python programming", source: "Local prototype vocabulary" },
  ]);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillLoadError, setSkillLoadError] = useState("");
  const [skillExtractionConsent, setSkillExtractionConsent] = useState(false);
  const [skillExtractionBusy, setSkillExtractionBusy] = useState(false);
  const [skillExtractionCompleted, setSkillExtractionCompleted] = useState(false);
  const [skillReviewApplied, setSkillReviewApplied] = useState(false);
  const [skillExtractionCandidates, setSkillExtractionCandidates] = useState<SkillExtractionCandidate[]>([]);
  const [selectedSkillCandidates, setSelectedSkillCandidates] = useState<number[]>([]);
  const [skillExtractionNotice, setSkillExtractionNotice] = useState("");
  const [skillExtractionError, setSkillExtractionError] = useState("");
  const [educationRecord, setEducationRecord] = useState("Completed fictional coursework in applied statistics and data visualisation, including practice explaining charts and findings in concise written reports.");
  const [workExperience, setWorkExperience] = useState("Collaborated with a four-person student team, planned weekly project milestones, shared progress updates, and presented findings to a fictional campus sustainability committee.");
  const [projects, setProjects] = useState("Created a dashboard comparing fictional campus energy use and waste. Coordinated tasks with teammates, planned a two-week delivery, and explained recommendations to peers. Used sustainability principles to compare options and propose ways to reduce waste.");
  const [certifications, setCertifications] = useState("Demo training: Python data analysis and spreadsheet fundamentals.");
  const [achievements, setAchievements] = useState("Presented the team dashboard at a fictional campus showcase; feedback praised clear communication and practical sustainability recommendations.");
  const [workActivities, setWorkActivities] = useState("Analyzing data, checking spreadsheets, preparing presentations, and coordinating team tasks.");
  const [strengths, setStrengths] = useState("Clear written and verbal communication, critical thinking, practical problem solving, and collaboration.");
  const [skillsToDevelop, setSkillsToDevelop] = useState("Data visualisation, facilitation, and presenting to larger groups.");
  const [aspiration, setAspiration] = useState("Explore data-informed work that helps teams make more sustainable decisions.");
  const [profileSummary, setProfileSummary] = useState("Information Systems student who builds clear data summaries and shares evidence-based recommendations with teams.");
  const [weeklyHours, setWeeklyHours] = useState("5");
  const [learningBudget, setLearningBudget] = useState("100");
  const [learningMode, setLearningMode] = useState("Self-paced");
  const [showSkipSkillPrompt, setShowSkipSkillPrompt] = useState(false);
  const [message, setMessage] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const majorInputRef = useRef<HTMLInputElement>(null);
  const skillSearchRef = useRef<HTMLInputElement>(null);
  const experienceListRef = useRef<HTMLDivElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const cancelSkipRef = useRef<HTMLButtonElement>(null);
  const lastStep = 8;

  useEffect(() => {
    const updateScrollState = () => setHasScrolled(window.scrollY > 8);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  useEffect(() => {
    const introTimer = window.setTimeout(() => setShowRegisterIntro(false), 1600);
    return () => window.clearTimeout(introTimer);
  }, []);

  useEffect(() => {
    if (!isCreatingProfile) return;
    const readyTimer = window.setTimeout(() => setCreationPhase(1), 3100);
    const finishTimer = window.setTimeout(() => router.replace("/profile"), 3900);
    return () => {
      window.clearTimeout(readyTimer);
      window.clearTimeout(finishTimer);
    };
  }, [isCreatingProfile, router]);

  useEffect(() => {
    if (activeStep === 0) nameInputRef.current?.focus();
    if (activeStep === 1) majorInputRef.current?.focus();
    if (activeStep === 2) skillSearchRef.current?.focus();
  }, [activeStep]);

  useEffect(() => {
    if (!showSkipSkillPrompt) return;
    cancelSkipRef.current?.focus();
    function handlePromptKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowSkipSkillPrompt(false);
        return;
      }
      if (event.key !== "Tab") return;
      const buttons = document.querySelectorAll<HTMLButtonElement>(".skill-skip-dialog button:not(:disabled)");
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handlePromptKeyDown);
    return () => {
      document.removeEventListener("keydown", handlePromptKeyDown);
      continueButtonRef.current?.focus();
    };
  }, [showSkipSkillPrompt]);

  useEffect(() => {
    if (activeStep !== 3 || jobExperiences.length < 2) return;
    const list = experienceListRef.current;
    if (!list) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ top: list.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
  }, [activeStep, jobExperiences.length]);

  useEffect(() => {
    if (activeStep !== 2) return;
    let active = true;
    setSkillLoading(true);
    const timer = window.setTimeout(() => {
      getSkills(skillQuery).then((result) => {
        if (active) {
          setSkillOptions(result.skills);
          setSkillLoadError("");
        }
      }).catch(() => {
        if (active) {
          setSkillOptions([]);
          setSkillLoadError("The skill list is unavailable. You can still add a custom skill.");
        }
      }).finally(() => { if (active) setSkillLoading(false); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [activeStep, skillQuery]);

  function advanceRegistrationStep() {
    if (activeStep === null) return;
    if (activeStep < lastStep) setActiveStep(activeStep + 1);
    else {
      const completedProfile: PathwaayRegistrationProfile = {
        firstName, lastName, email, educationLevel, university, major, cgpa, schoolAwards,
        experiences: jobExperiences,
        skills: selectedSkills.map((skill) => skill.name),
        skillLinks: selectedSkills.map((skill) => ({
          name: skill.name,
          skill_id: skill.id.startsWith("custom:") ? null : skill.id,
          taxonomy_source: skill.source,
        })),
        educationRecord, volunteering: workExperience, projects, certifications, achievements,
        interests: otherInterests, workActivities, strengths, skillsToDevelop, aspiration, profileSummary,
        weeklyHours, learningBudget, learningMode,
      };
      try { window.sessionStorage.setItem(PATHWAAY_PROFILE_HANDOFF_KEY, JSON.stringify(completedProfile)); } catch { /* Keep the session flow moving if storage is unavailable. */ }
      setCreationPhase(0);
      setIsCreatingProfile(true);
      setActiveStep(lastStep + 1);
    }
  }

  function handleNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeStep === null) return;
    if (activeStep === 7 && !skillExtractionCompleted) {
      setShowSkipSkillPrompt(true);
      return;
    }
    if (activeStep === 7 && skillExtractionCandidates.length > 0 && !skillReviewApplied) {
      setSkillExtractionError(
        selectedSkillCandidates.length
          ? "Click “Add selected skills to my profile” before continuing."
          : "Select at least one suggested skill, then add it to your profile before continuing.",
      );
      return;
    }
    advanceRegistrationStep();
  }

  function startJourney() {
    setJourneyTransition(true);
    setActiveStep(-1);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => setJourneyTransition(false), 900);
  }

  function addSkill(skill: ChosenSkill) {
    setSelectedSkills((current) => current.some((item) => item.id === skill.id) ? current : [...current, skill]);
    setSkillQuery("");
  }

  function addCustomSkill() {
    const name = skillQuery.trim();
    if (!name) return;
    addSkill({ id: `custom:${name.toLocaleLowerCase()}`, name, source: "Custom skill" });
  }

  function updateJobExperience(id: string, field: keyof Omit<JobExperience, "id">, value: string) {
    setJobExperiences((entries) => entries.map((entry) => entry.id === id ? { ...entry, [field]: value } : entry));
  }

  function addJobExperience() {
    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setJobExperiences((entries) => [...entries, { id, title: "", timeframe: "", company: "", description: "" }]);
  }

  function removeJobExperience(id: string) {
    setJobExperiences((entries) => entries.filter((entry) => entry.id !== id));
  }

  function collectRegistrationEvidence(): SkillEvidenceInput[] {
    const evidence: SkillEvidenceInput[] = jobExperiences.flatMap((entry) => {
      const description = entry.description.trim();
      if (!description) return [];
      const text = [entry.title.trim() ? `Title: ${entry.title.trim()}` : "", description].filter(Boolean).join("\n");
      return [{ source_id: entry.id, source_label: "Work experience", text }];
    });
    const sourceFields: [string, string][] = [
      ["Education and coursework", educationRecord],
      ["Work and volunteering", workExperience],
      ["Project", projects],
      ["Certification or training", certifications],
      ["Achievement", achievements],
      ["Work activity", workActivities],
      ["Transferable strength", strengths],
      ["Profile summary", profileSummary],
    ];
    for (const [sourceLabel, text] of sourceFields) {
      if (text.trim()) evidence.push({ source_id: null, source_label: sourceLabel, text: text.trim() });
    }
    return evidence;
  }

  async function extractRegistrationSkills() {
    setSkillExtractionError("");
    setSkillExtractionNotice("");
    setSkillExtractionCompleted(false);
    setSkillReviewApplied(false);
    setSkillExtractionCandidates([]);
    setSelectedSkillCandidates([]);
    if (!skillExtractionConsent) {
      setSkillExtractionError("Confirm fictional-only use before sending descriptions to the AI model.");
      return;
    }
    const evidence = collectRegistrationEvidence();
    if (!evidence.length) {
      setSkillExtractionError("Add an experience, project, coursework, activity, or profile summary first.");
      return;
    }
    if (evidence.length > 50 || evidence.reduce((total, item) => total + item.text.length, 0) > 30_000) {
      setSkillExtractionError("Use up to 50 descriptions and 30,000 total characters per extraction.");
      return;
    }

    setSkillExtractionBusy(true);
    try {
      const candidates = await extractProfileSkills(evidence, 10);
      setSkillExtractionCandidates(candidates);
      setSelectedSkillCandidates([]);
      setSkillExtractionCompleted(true);
      setSkillExtractionNotice(candidates.length
        ? "Suggestions are ready. Review each evidence quote and taxonomy match before adding skills."
        : "The model found no supported matches in the current local taxonomy.");
    } catch (error) {
      setSkillExtractionError(error instanceof Error ? error.message : "AI skill extraction could not be completed.");
    } finally {
      setSkillExtractionBusy(false);
    }
  }

  function applyRegistrationSkillReview() {
    const selected = skillExtractionCandidates.filter((_, index) => selectedSkillCandidates.includes(index));
    if (!selected.length) {
      setSkillExtractionError("Select at least one suggested skill to add.");
      return;
    }
    const currentEvidence = collectRegistrationEvidence();
    const chosen = selected.filter((candidate) => candidate.evidence && currentEvidence.some((item) => {
      const sourceMatches = candidate.evidence_record_ids.length
        ? candidate.evidence_record_ids.includes(item.source_id ?? "")
        : item.source_label === candidate.evidence_source;
      const normalizedText = item.text.toLowerCase().trim().replace(/\s+/g, " ");
      const normalizedQuote = candidate.evidence?.toLowerCase().trim().replace(/\s+/g, " ") ?? "";
      return sourceMatches && normalizedQuote.length > 0 && normalizedText.includes(normalizedQuote);
    }));
    if (!chosen.length) {
      setSkillExtractionError("The source descriptions changed since extraction. Run it again to refresh the evidence.");
      setSkillExtractionCompleted(false);
      setSkillExtractionCandidates([]);
      setSelectedSkillCandidates([]);
      return;
    }
    setSelectedSkills((current) => {
      const next = [...current];
      for (const candidate of chosen) {
        if (!candidate.skill_id || !candidate.canonical_name || next.some((skill) => skill.id === candidate.skill_id)) continue;
        next.push({ id: candidate.skill_id, name: candidate.canonical_name, source: "Local prototype vocabulary" });
      }
      return next;
    });
    setSkillReviewApplied(true);
    setSkillExtractionNotice(`${chosen.length} supported skill${chosen.length === 1 ? "" : "s"} added to your selected skills${chosen.length < selected.length ? `; ${selected.length - chosen.length} stale suggestion${selected.length - chosen.length === 1 ? " was" : "s were"} skipped` : ""}. The taxonomy IDs will be kept with your session profile.`);
  }

  const recommendedSkills = skillOptions.filter((skill) => recommendedSkillNames.includes(skill.name));
  const allCandidatesSelected = skillExtractionCandidates.length > 0
    && selectedSkillCandidates.length === skillExtractionCandidates.length;

  const canContinue = activeStep === 0 ? firstName.trim().length > 0 && lastName.trim().length > 0 && email.trim().length > 0
    : activeStep === 1 ? major.trim().length > 0
    : activeStep === 2 ? selectedSkills.length > 0
        : true;

  return (
    <main className={`login-page register-page ${activeStep === null ? "is-welcome" : "is-onboarding"}${activeStep === 7 ? " is-skill-review" : ""}${activeStep === -1 ? " is-cv-fast-track" : ""}`}>
      <div className="ambient-layer" aria-hidden="true" />
      <header className={`login-topbar ${hasScrolled ? "is-scrolled" : ""}`}>
        <Link className="brand" href="/" aria-label="Pathwaay home"><span className="brand-mark">P</span> Pathwaay <span className="brand-note">CAREER EXPLORER</span></Link>
        <Link className="login-back-link" href="/login">Log in <span aria-hidden="true">↗</span></Link>
      </header>
      <div className={`journey-transition ${journeyTransition ? "is-active" : ""}`} aria-hidden="true"><span /><span /><span /></div>
      {showRegisterIntro && <div className="register-intro" aria-hidden="true"><span className="register-intro-mark">P</span><span className="register-intro-word">Pathwaay.</span></div>}

      {activeStep === null ? <section className="welcome-stage" aria-labelledby="welcome-title">
        <div className="welcome-orbit" aria-hidden="true">
          <span className="welcome-orbit-core"><span>P</span></span>
          <span className="welcome-orbit-ring welcome-orbit-one"><i /></span>
          <span className="welcome-orbit-ring welcome-orbit-two"><i /></span>
          <span className="welcome-orbit-ring welcome-orbit-three"><i /></span>
          <span className="welcome-orbit-path" />
        </div>
        <div className="welcome-copy">
          <p className="eyebrow"><span className="welcome-live-dot" /> PATHWAAY / CAREER EXPLORER</p>
          <h1 id="welcome-title">Welcome to<br /><span>Pathwaay.</span></h1>
          <p>Your skills are a starting point. Your future has more than one direction. Let’s find the next step that feels like yours.</p>
          <button type="button" className="welcome-cta" onClick={startJourney} disabled={showRegisterIntro}><span>Begin your journey</span><span className="welcome-cta-icon" aria-hidden="true">→</span></button>
          <div className="welcome-pill-row"><span>CAREER PATHS</span><i /><span>SDG CONNECTIONS</span><i /><span>FUTURE SCENARIOS</span></div>
        </div>
        <ParticleWave />
        <div className="welcome-scroll-cue"><span className="scroll-cue-line" /><span>A NEW PATHWAY IS TAKING SHAPE</span><span className="scroll-cue-arrow">→</span></div>
      </section> : activeStep === -1 ? <CVFastTrack onBack={() => setActiveStep(null)} onManual={() => setActiveStep(0)} /> : activeStep <= lastStep ? <section className="onboarding-stage" aria-live="polite">
        <div className="onboarding-orbit" aria-hidden="true"><span /><i /><i /><i /></div>
        <ParticleWave />
        <div className="onboarding-scene">
          <div className="onboarding-topline"><button type="button" className="onboarding-back" onClick={() => setActiveStep(activeStep === 0 ? null : activeStep - 1)}>← <span>{activeStep === 0 ? "Welcome" : "Back"}</span></button><span className="onboarding-count">{String(activeStep + 1).padStart(2, "0")} <i>/</i> 09</span></div>
          <div className="onboarding-progress" role="progressbar" aria-label="Profile setup progress" aria-valuemin={1} aria-valuemax={9} aria-valuenow={activeStep + 1}><span style={{ width: `${((activeStep + 1) / 9) * 100}%` }} /></div>
          <form key={activeStep} className="onboarding-form onboarding-content" onSubmit={handleNext}>
            {activeStep === 0 && <div className="onboarding-question">
              <span className="onboarding-step-tag">FIRST, THE HUMAN BEHIND THE PATH</span>
              <h1>What should<br />we call you?</h1>
              <p>Pre-filled fictional demo details: edit them as needed before continuing.</p>
              <div className="onboarding-name-fields">
                <label className="onboarding-label" htmlFor="journey-first-name">First name</label>
                <div className="login-input-wrap onboarding-input"><span aria-hidden="true">◎</span><input ref={nameInputRef} id="journey-first-name" name="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" placeholder="Your first name" required /></div>
                <label className="onboarding-label" htmlFor="journey-last-name">Last name</label>
                <div className="login-input-wrap onboarding-input"><span aria-hidden="true">◎</span><input id="journey-last-name" name="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" placeholder="Your last name" required /></div>
                <label className="onboarding-label" htmlFor="journey-email">Email address</label>
                <div className="login-input-wrap onboarding-input"><span aria-hidden="true">✉</span><input id="journey-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></div>
              </div>
            </div>}

            {activeStep === 1 && <div className="onboarding-question">
              <span className="onboarding-step-tag">YOUR UNIVERSITY JOURNEY</span>
              <h1>Where are you<br />studying?</h1>
              <p>Tell us about your school, university, or course of study.</p>
              <div className="onboarding-field-grid">
                <label className="onboarding-label">Education level<select className="onboarding-select" value={educationLevel} onChange={(event) => setEducationLevel(event.target.value)}>{educationOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="onboarding-label">University or school<input className="onboarding-control" value={university} onChange={(event) => setUniversity(event.target.value)} placeholder="Your university or school" /></label>
                <label className="onboarding-label">Major or field of study<input ref={majorInputRef} className="onboarding-control" value={major} onChange={(event) => setMajor(event.target.value)} autoComplete="off" placeholder="e.g. Data Science" required /></label>
                <label className="onboarding-label">Overall CGPA<input className="onboarding-control" type="number" min="0" max="4" step="0.01" value={cgpa} onChange={(event) => setCgpa(event.target.value)} placeholder="Optional · out of 4.00" /></label>
                <label className="onboarding-label">School honours and awards<textarea className="onboarding-textarea onboarding-textarea-short" value={schoolAwards} onChange={(event) => setSchoolAwards(event.target.value)} placeholder="Optional academic honours or awards" /></label>
              </div>
              <div className="onboarding-suggestions"><span>TRY</span>{["Data Science", "Computer Science", "Business", "Still exploring"].map((item) => <button type="button" key={item} onClick={() => setMajor(item)}>{item}</button>)}</div>
            </div>}

            {activeStep === 2 && <div className="onboarding-question">
              <span className="onboarding-step-tag">BUILD YOUR SKILL PROFILE</span>
              <h1>Add your skills</h1>
              <p>Search the skill list or start with a few suggestions. Select all that apply.</p>
              <div className="skill-picker">
                <label className="onboarding-label" htmlFor="journey-skill-search">Search skills</label>
                <input ref={skillSearchRef} id="journey-skill-search" className="onboarding-control" type="search" value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="Try Python, data analysis, communication…" autoComplete="off" />
                {skillQuery.trim() && <div className="onboarding-skill-results" role="listbox" aria-label="Skill search results">
                  {skillLoading && <span className="onboarding-skill-message" role="status">Searching skills…</span>}
                  {!skillLoading && skillOptions.slice(0, 5).map((skill) => <button className="onboarding-skill-result" type="button" key={skill.id} role="option" aria-selected={selectedSkills.some((item) => item.id === skill.id)} onClick={() => addSkill({ id: skill.id, name: skill.name, source: skill.taxonomy_source })}><span>{skill.name}</span><small>{selectedSkills.some((item) => item.id === skill.id) ? "Added" : "Add skill"}</small></button>)}
                  {!skillLoading && skillOptions.length === 0 && <span className="onboarding-skill-message">{skillLoadError || "No matching skills found."}</span>}
                  {!skillLoading && skillOptions.length === 0 && <button className="onboarding-skill-result custom" type="button" onClick={addCustomSkill}><span>Add “{skillQuery.trim()}” as a custom skill</span><small>Add</small></button>}
                </div>}
                {skillLoadError && !skillQuery.trim() && <span className="onboarding-field-hint" role="status">{skillLoadError}</span>}
                <div className="onboarding-recommendations" aria-label="Suggested skills">
                  <span className="onboarding-recommendation-label">SUGGESTED SKILLS</span>
                  {recommendedSkills.map((skill) => {
                    const selected = selectedSkills.some((item) => item.id === skill.id);
                    return <button type="button" className={`onboarding-skill-chip ${selected ? "selected" : ""}`} key={skill.id} aria-pressed={selected} onClick={() => addSkill({ id: skill.id, name: skill.name, source: skill.taxonomy_source })}>{skill.name}{selected && <span aria-hidden="true"> ✓</span>}</button>;
                  })}
                </div>
                {selectedSkills.length > 0 && <div className="onboarding-selected-skills" aria-label="Selected skills">
                  <span className="onboarding-recommendation-label">YOUR SKILLS · {selectedSkills.length}</span>
                  {selectedSkills.map((skill) => <span className="onboarding-selected-skill" key={skill.id}>{skill.name}<button type="button" aria-label={`Remove ${skill.name}`} onClick={() => setSelectedSkills((current) => current.filter((item) => item.id !== skill.id))}>×</button></span>)}
                </div>}
              </div>
            </div>}

            {activeStep === 3 && <div className="onboarding-question experience-question">
              <span className="onboarding-step-tag">YOUR EXPERIENCE SO FAR</span>
              <h1>What’s your experience<br />so far?</h1>
              <p>Add a role or placement. You can include more than one, and every field is optional.</p>
              <div ref={experienceListRef} className={`experience-list-scroll ${jobExperiences.length > 1 ? "has-multiple" : ""}`}>
                <button type="button" className="experience-add" onClick={addJobExperience}><span aria-hidden="true">+</span> Add another job</button>
                {jobExperiences.map((entry, index) => <section className="experience-entry" key={entry.id} aria-label={`Experience ${index + 1}`}>
                  <div className="experience-entry-header"><span>EXPERIENCE {String(index + 1).padStart(2, "0")}</span>{jobExperiences.length > 1 && <button type="button" className="experience-remove" onClick={() => removeJobExperience(entry.id)} aria-label={`Remove experience ${index + 1}`}>Remove</button>}</div>
                  <div className="onboarding-field-grid experience-fields">
                    <label className="onboarding-label">Job title<input className="onboarding-control" value={entry.title} onChange={(event) => updateJobExperience(entry.id, "title", event.target.value)} placeholder="e.g. Data intern" /></label>
                    <label className="onboarding-label">Timeframe<input className="onboarding-control" value={entry.timeframe} onChange={(event) => updateJobExperience(entry.id, "timeframe", event.target.value)} placeholder="e.g. Jun 2024 to Aug 2024" /></label>
                    <label className="onboarding-label experience-company">Company or organisation<input className="onboarding-control" value={entry.company} onChange={(event) => updateJobExperience(entry.id, "company", event.target.value)} placeholder="Company, organisation, or client" /></label>
                    <label className="onboarding-label experience-description">Description<textarea className="onboarding-textarea" value={entry.description} onChange={(event) => updateJobExperience(entry.id, "description", event.target.value)} placeholder="What did you work on or contribute?" /></label>
                  </div>
                </section>)}
              </div>
            </div>}

            {activeStep === 4 && <div className="onboarding-question">
              <span className="onboarding-step-tag">LEARNING AND EXPERIENCE</span>
              <h1>What have you<br />done so far?</h1>
              <p>Coursework, volunteering, jobs, or any learning that feels relevant. Brief notes are enough.</p>
              <div className="onboarding-field-grid">
                <label className="onboarding-label">Learning or education record<textarea className="onboarding-textarea" value={educationRecord} onChange={(event) => setEducationRecord(event.target.value)} placeholder="Course, subject, or learning experience" /></label>
                <label className="onboarding-label">Work or volunteering<textarea className="onboarding-textarea" value={workExperience} onChange={(event) => setWorkExperience(event.target.value)} placeholder="Role, activity, or contribution" /></label>
              </div>
            </div>}

            {activeStep === 5 && <div className="onboarding-question">
              <span className="onboarding-step-tag">SMALL PROOF POINTS COUNT</span>
              <h1>Anything else<br />you’ve built?</h1>
              <p>Add optional examples that show what you’ve learned. Fictional or general descriptions only.</p>
              <div className="onboarding-field-grid">
                <label className="onboarding-label">Projects<textarea className="onboarding-textarea" value={projects} onChange={(event) => setProjects(event.target.value)} placeholder="A project, contribution, or piece of work" /></label>
                <label className="onboarding-label">Certifications or training<textarea className="onboarding-textarea" value={certifications} onChange={(event) => setCertifications(event.target.value)} placeholder="Completed courses or training" /></label>
                <label className="onboarding-label">Achievements<textarea className="onboarding-textarea" value={achievements} onChange={(event) => setAchievements(event.target.value)} placeholder="Recognition, milestones, or results" /></label>
              </div>
            </div>}

            {activeStep === 6 && <div className="onboarding-question">
              <span className="onboarding-step-tag">WHAT GIVES YOUR WORK SHAPE</span>
              <h1>What would you<br />like to move toward?</h1>
              <p>Share the kinds of work you enjoy and the skills you hope to build next.</p>
              <div className="onboarding-field-grid">
                <label className="onboarding-label">Interests or topics<textarea className="onboarding-textarea" value={otherInterests} onChange={(event) => setOtherInterests(event.target.value)} placeholder="e.g. sustainability, design, education" /></label>
                <label className="onboarding-label">Work activities<textarea className="onboarding-textarea" value={workActivities} onChange={(event) => setWorkActivities(event.target.value)} placeholder="e.g. analysing, designing, helping people" /></label>
                <label className="onboarding-label">Transferable strengths<textarea className="onboarding-textarea" value={strengths} onChange={(event) => setStrengths(event.target.value)} placeholder="e.g. clear communication, curiosity" /></label>
                <label className="onboarding-label">Skills to develop<textarea className="onboarding-textarea" value={skillsToDevelop} onChange={(event) => setSkillsToDevelop(event.target.value)} placeholder="e.g. data visualisation, facilitation" /></label>
                <label className="onboarding-label">Career aspiration<textarea className="onboarding-textarea" value={aspiration} onChange={(event) => setAspiration(event.target.value)} placeholder="A kind of work or contribution you want to explore" /></label>
                <label className="onboarding-label">Short profile introduction<textarea className="onboarding-textarea" value={profileSummary} onChange={(event) => setProfileSummary(event.target.value)} placeholder="A few words about what you bring or care about" /></label>
              </div>
            </div>}

            {activeStep === 7 && <div className="onboarding-question onboarding-skill-extraction-step">
              <span className="onboarding-step-tag">AI-ASSISTED SKILL REVIEW</span>
              <h1>Review your<br />skill suggestions</h1>
              <p>Use AI to identify skills supported by the descriptions you provided. Review every suggestion before adding it to your profile.</p>
              <section className="onboarding-ai-tools" aria-labelledby="onboarding-ai-skills-heading">
                <div><h2 id="onboarding-ai-skills-heading">Extract skills from your descriptions</h2><p>RunPod will read your experience, coursework, project and achievement descriptions, plus work activities and strengths. Names, email, school details, interests, aspirations and learning preferences are not sent. The fictional sample contains evidence intended to support up to 10 skill suggestions; the model may return fewer.</p></div>
                <label className="onboarding-ai-consent"><input type="checkbox" checked={skillExtractionConsent} onChange={(event) => setSkillExtractionConsent(event.target.checked)} /><span>I confirm the included descriptions are fictional and consent to send them to RunPod for skill analysis. The app does not save this extraction request; RunPod’s configured data-retention terms apply.</span></label>
                <div className="onboarding-ai-actions">
                  <button className="login-submit onboarding-ai-button" type="button" onClick={() => void extractRegistrationSkills()} disabled={skillExtractionBusy || !skillExtractionConsent} data-testid="button-onboarding-ai-extract">{skillExtractionBusy ? "Understanding your descriptions…" : "Extract skills from my descriptions"}</button>
                  {skillExtractionCandidates.length > 0 && <button className={`onboarding-ai-add${skillReviewApplied ? " is-applied" : ""}`} type="button" onClick={applyRegistrationSkillReview} disabled={skillReviewApplied || !selectedSkillCandidates.length}>{skillReviewApplied ? "✓ Added to my profile" : "Add selected skills to my profile"}</button>}
                </div>
                {skillExtractionBusy && <p className="onboarding-ai-status" role="status">The model is checking your descriptions against the current local skill taxonomy.</p>}
                {skillExtractionError && <p className="onboarding-ai-error" role="alert">{skillExtractionError}</p>}
                {skillExtractionNotice && <p className="onboarding-ai-status" role="status">{skillExtractionNotice}</p>}
                {skillExtractionCandidates.length > 0 && <>
                  <div className="onboarding-ai-candidate-toolbar">
                    <span>{selectedSkillCandidates.length} of {skillExtractionCandidates.length} selected</span>
                    <button type="button" className="onboarding-ai-select-all" onClick={() => setSelectedSkillCandidates(allCandidatesSelected ? [] : skillExtractionCandidates.map((_, index) => index))} disabled={skillReviewApplied}>{allCandidatesSelected ? "Deselect all" : "Select all"}</button>
                  </div>
                  <div className="onboarding-ai-candidates" aria-label="AI skill candidates">
                  {skillExtractionCandidates.map((candidate, index) => <label className="onboarding-ai-candidate" key={candidate.skill_id ?? index}>
                    <input type="checkbox" checked={selectedSkillCandidates.includes(index)} disabled={skillReviewApplied} onChange={(event) => setSelectedSkillCandidates((current) => event.target.checked ? [...current, index] : current.filter((item) => item !== index))} />
                    <span><strong>{candidate.canonical_name}</strong><small>{candidate.evidence_source} · {candidate.skill_id}</small>{candidate.evidence && <q>{candidate.evidence}</q>}{candidate.rationale && <small>{candidate.rationale}</small>}</span>
                  </label>)}
                  </div>
                </>}
              </section>
            </div>}

            {activeStep === 8 && <div className="onboarding-question">
              <span className="onboarding-step-tag">MAKE LEARNING REALISTIC</span>
              <h1>What could fit<br />your week?</h1>
              <p>These preferences help you think about a practical learning pathway. Every answer is optional.</p>
              <div className="onboarding-field-grid">
                <label className="onboarding-label">Hours available per week<input className="onboarding-control" type="number" min="0" max="168" value={weeklyHours} onChange={(event) => setWeeklyHours(event.target.value)} placeholder="Not sure yet" /></label>
                <label className="onboarding-label">Learning budget (MYR)<input className="onboarding-control" type="number" min="0" max="100000" step="10" value={learningBudget} onChange={(event) => setLearningBudget(event.target.value)} placeholder="Not sure yet" /></label>
                <label className="onboarding-label">Preferred learning format<select className="onboarding-select" value={learningMode} onChange={(event) => setLearningMode(event.target.value)}><option value="">Choose later</option>{learningModes.map((item) => <option key={item}>{item}</option>)}</select></label>
              </div>
            </div>}

            <div className="onboarding-actions"><span className="onboarding-note">YOUR CHOICES STAY IN THIS SESSION</span><button ref={continueButtonRef} className="login-submit onboarding-next" type="submit" disabled={!canContinue}><span>{activeStep === lastStep ? "Shape my pathway" : "Continue"}</span><span aria-hidden="true">→</span></button></div>
          </form>
        </div>
      </section> : <section className="onboarding-stage" aria-label="Creating your profile">
        <div className="onboarding-orbit" aria-hidden="true"><span /><i /><i /><i /></div>
        <ParticleWave />
        <div className="onboarding-scene onboarding-processing" role="status" aria-live="polite" aria-atomic="true">
          <div className="processing-orbit" aria-hidden="true"><span className="processing-orbit-core">P</span><i /><i /><i /></div>
          <p className="eyebrow processing-phase">{creationPhase === 0 ? "BUILDING YOUR PROFILE" : "PROFILE READY"}</p>
          <h1>{creationPhase === 0 ? <>Building<br /><span>your profile</span></> : <>Done<span>.</span></>}</h1>
          <p className="processing-caption">{creationPhase === 0 ? "Bringing your skills, interests, and experience together." : "Opening My Profile…"}</p>
          <div className="processing-meter" aria-hidden="true"><span className={creationPhase === 1 ? "is-ready" : ""} /></div>
          <p className="processing-preview-note">Your answers stay in this session</p>
        </div>
      </section>}

      {showSkipSkillPrompt && <div className="skill-skip-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSkipSkillPrompt(false); }}>
        <section className="skill-skip-dialog" role="alertdialog" aria-modal="true" aria-labelledby="skill-skip-title" aria-describedby="skill-skip-description">
          <span className="onboarding-step-tag">AI-ASSISTED SKILL REVIEW</span>
          <h2 id="skill-skip-title">Skip skill extraction?</h2>
          <p id="skill-skip-description">You haven’t extracted skills from your descriptions. Continue without AI skill suggestions, or go back and run the skill review.</p>
          <div className="skill-skip-actions">
            <button ref={cancelSkipRef} className="skill-skip-cancel" type="button" onClick={() => setShowSkipSkillPrompt(false)}>Go back</button>
            <button className="skill-skip-confirm" type="button" onClick={() => { setShowSkipSkillPrompt(false); advanceRegistrationStep(); }}>Skip and continue</button>
          </div>
        </section>
      </div>}

      <footer className="login-footer"><span>PATHWAAY <i>·</i> CAREER EXPLORER</span><span>Build skills for a changing future.</span></footer>
    </main>
  );
}
