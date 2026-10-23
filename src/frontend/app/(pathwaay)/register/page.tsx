"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { extractProfileSkills, getEscoSkills, type SkillEvidenceInput, type SkillExtractionCandidate, type SkillOption } from "@/lib/api";
import { PATHWAAY_PROFILE_HANDOFF_KEY, type PathwaayRegistrationProfile } from "@/lib/pathwaay-profile";

import { saveHybridProfile } from "@/lib/hybrid-profile";

const educationOptions = ["Secondary", "Certificate", "Diploma", "Bachelor’s degree", "Postgraduate", "Other"];
const learningModes = ["Self-paced", "Instructor-led", "Peer learning", "A mix of formats"];
const recommendedSkillNames = [
  "Python (computer programming)",
  "perform data analysis",
  "machine learning",
  "communication",
  "solve problems",
  "think critically",
];

type ChosenSkill = { id: string; name: string; source: string };
type JobExperience = { id: string; title: string; timeframe: string; company: string; description: string };

const demoPresetSkills: ChosenSkill[] = [
  { id: "http://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d", name: "Python (computer programming)", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/2b92a5b2-6758-4ee3-9fb4-b6387a55cc8f", name: "perform data analysis", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/1973c966-f236-40c9-b2d4-5d71a89019be", name: "use spreadsheets software", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/07889c08-7220-47c8-96f7-6068fbea00dc", name: "normalise data", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/1b70a55d-b8a4-49fc-96c6-15ab4cff2522", name: "use data processing techniques", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/1e77e42a-181f-4b48-8e74-201ce50ffc29", name: "interpret current data", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/31c69100-b612-4a61-8db5-fd314318854c", name: "execute analytical mathematical calculations", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/382c11ed-20d5-4ae7-b60e-15fec527fa6c", name: "apply statistical analysis techniques", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/4463a721-69f3-413d-8321-43e3af13a4f1", name: "use databases", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/4a193795-fa63-414e-9f2e-bfdb3924571e", name: "handle data samples", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/50b100ea-74fd-4706-99db-3e4ca55e51b8", name: "perform data cleansing", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/54c9c155-9293-4329-8ed2-2e76e8b519d4", name: "define data quality criteria", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/79e29b8b-47d1-470d-b7b1-32506bfe7d9a", name: "collect ICT data", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/918f5211-b99f-4b29-9a34-6e475583ef55", name: "write work-related reports", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/27ed854c-15b8-4ba2-90e9-ae888a219703", name: "perform business analysis", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/56042303-972b-41be-9310-58467599ff7e", name: "analyse business processes", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/03b9b491-fc9b-4868-914a-bf7cd47b5041", name: "create solutions to problems", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/415abd43-e8e5-4643-b5da-5f11307af57a", name: "use different communication channels", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/3c03ee71-4a23-448f-b79e-81fd75d27dca", name: "apply change management", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/43d1d56b-ce62-4fe8-8f18-35d92ec73023", name: "identify undetected organisational needs", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/91816e1a-d026-4d21-9b1c-59ca5cf488de", name: "analyse internal factors of companies", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/ce5b1446-b5e3-4f05-a5ac-83f2ee142a44", name: "analyse external factors of companies", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/f14ff4b7-be1e-4b55-b39b-520005f8a97e", name: "liaise with managers", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/48b68726-0fd6-4e03-a5eb-82236516ee7a", name: "provide cost benefit analysis reports", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/07e51c60-763a-4335-b4ec-70a15f66d328", name: "propose ICT solutions to business problems", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/0e0c9c11-b39e-43cf-ba95-2fe646f5de64", name: "identify customer requirements", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/a8797f21-1af0-4c5e-98ca-bf1442929363", name: "interact with users to gather requirements", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/d9e5349e-8791-49c2-8ba4-839fdd1606c2", name: "define technical requirements", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/6a7792a9-888a-46ad-afc9-2c0d94c8fde6", name: "create business process models", source: "ESCO v1.2.1" },
  { id: "http://data.europa.eu/esco/skill/cd5efa8c-e44d-4cbc-91c6-796018dbed68", name: "perform project management", source: "ESCO v1.2.1" },
];

const demoExperience: JobExperience = {
  id: "demo-experience-1",
  title: "Data & Business Analysis Intern",
  timeframe: "Jan 2025 – Apr 2025",
  company: "Aiversecity Demo Lab",
  description: "Fictional campus analytics project: collected sample energy and waste records from spreadsheets and a database, normalised and cleaned the data, documented quality checks, and used Python and basic statistics to interpret patterns. Gathered user requirements from a fictional campus team, mapped the existing reporting process, proposed a dashboard workflow, compared options with a simple cost-benefit report, coordinated milestones, and presented recommendations.",
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
  const [backendSaving, setBackendSaving] = useState(false);
  const [backendError, setBackendError] = useState("");
  const saveInFlight = useRef(false);
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
  const [selectedSkills, setSelectedSkills] = useState<ChosenSkill[]>(() => demoPresetSkills.map((skill) => ({ ...skill })));
  const [recommendedSkillOptions, setRecommendedSkillOptions] = useState<SkillOption[]>([]);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillLoadError, setSkillLoadError] = useState("");
  const [recommendedSkillLoadError, setRecommendedSkillLoadError] = useState("");
  const [skillExtractionConsent, setSkillExtractionConsent] = useState(false);
  const [skillExtractionBusy, setSkillExtractionBusy] = useState(false);
  const [skillExtractionCompleted, setSkillExtractionCompleted] = useState(false);
  const [skillReviewApplied, setSkillReviewApplied] = useState(false);
  const [skillExtractionCandidates, setSkillExtractionCandidates] = useState<SkillExtractionCandidate[]>([]);
  const [selectedSkillCandidates, setSelectedSkillCandidates] = useState<number[]>([]);
  const [skillExtractionNotice, setSkillExtractionNotice] = useState("");
  const [skillExtractionError, setSkillExtractionError] = useState("");
  const skillExtractionController = useRef<AbortController | null>(null);
  const [educationRecord, setEducationRecord] = useState("Fictional coursework in applied statistics, relational databases, spreadsheet modelling, business process analysis, and requirements gathering. Completed exercises cleaning sample datasets, checking data quality, interpreting results, and writing concise reports.");
  const [workExperience, setWorkExperience] = useState("Collaborated with a fictional campus sustainability team, coordinated weekly milestones, gathered reporting needs, shared progress updates, incorporated feedback, and presented a dashboard with recommendations.");
  const [projects, setProjects] = useState("Built a fictional campus energy-and-waste dashboard. Collected sample survey and facilities records, combined spreadsheet and database extracts, normalised and cleaned data, applied basic statistical analysis in Python, documented quality checks, mapped reporting steps, gathered user requirements, compared dashboard options with a simple cost-benefit table, and wrote a findings report.");
  const [certifications, setCertifications] = useState("Fictional coursework exercises: Python data analysis, SQL/database queries, spreadsheet modelling, statistics, and dashboard reporting.");
  const [achievements, setAchievements] = useState("Presented the fictional campus dashboard at a student showcase, with a written analysis of data quality, user requirements, and practical recommendations.");
  const [workActivities, setWorkActivities] = useState("Collecting and cleaning data, validating samples, analysing trends, documenting requirements, mapping workflows, preparing reports, and coordinating project milestones.");
  const [strengths, setStrengths] = useState("Structured problem-solving, data accuracy, clear reporting, stakeholder communication, teamwork, and organised project follow-through.");
  const [skillsToDevelop, setSkillsToDevelop] = useState("Data visualisation, facilitation, and presenting to larger groups.");
  const [aspiration, setAspiration] = useState("Explore entry-level data analyst, business analyst, ICT business analyst, and digital operations roles.");
  const [profileSummary, setProfileSummary] = useState("Information Systems student building data analysis, business analysis, and digital workflow skills through fictional coursework and capstone projects.");
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

  useEffect(() => () => skillExtractionController.current?.abort(), []);

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
    const query = skillQuery.trim();
    const controller = new AbortController();
    if (query.length < 2) {
      setSkillOptions([]);
      setSkillLoading(false);
      setSkillLoadError("");
      return () => controller.abort();
    }
    setSkillLoading(true);
    const timer = window.setTimeout(() => {
      getEscoSkills(query, controller.signal).then((result) => {
        if (active) {
          setSkillOptions(result);
          setSkillLoadError("");
        }
      }).catch((error: unknown) => {
        if (active && !controller.signal.aborted) {
          setSkillOptions([]);
          setSkillLoadError(error instanceof Error ? error.message : "The ESCO skill list is unavailable.");
        }
      }).finally(() => { if (active) setSkillLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [activeStep, skillQuery]);

  useEffect(() => {
    if (activeStep !== 2) return;
    let active = true;
    const controller = new AbortController();
    setRecommendedSkillLoadError("");
    getEscoSkills(recommendedSkillNames.join("|"), controller.signal).then((results) => {
      if (active) {
        const byName = new Map(results.map((skill) => [skill.name.toLocaleLowerCase(), skill]));
        setRecommendedSkillOptions(
          recommendedSkillNames.flatMap((name) => {
            const skill = byName.get(name.toLocaleLowerCase());
            return skill ? [skill] : [];
          }),
        );
      }
    }).catch((error: unknown) => {
      if (active && !controller.signal.aborted) {
        setRecommendedSkillOptions([]);
        setRecommendedSkillLoadError(error instanceof Error ? error.message : "ESCO skill suggestions are unavailable.");
      }
    });
    return () => { active = false; controller.abort(); };
  }, [activeStep]);

  async function advanceRegistrationStep() {
    if (activeStep === null || saveInFlight.current) return;
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
      saveInFlight.current = true; setBackendSaving(true); setBackendError("");
      try { await saveHybridProfile(completedProfile); }
      catch (error) { setBackendError(error instanceof Error ? error.message : "Could not save your profile. Please retry."); return; }
      finally { saveInFlight.current = false; setBackendSaving(false); }
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
    setActiveStep(0);
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
    const controller = new AbortController();
    skillExtractionController.current = controller;
    try {
      const candidates = await extractProfileSkills(evidence, 10, controller.signal);
      setSkillExtractionCandidates(candidates);
      setSelectedSkillCandidates([]);
      setSkillExtractionCompleted(true);
      setSkillExtractionNotice(candidates.length
        ? "Suggestions are ready. Review each evidence quote and taxonomy match before adding skills."
        : "The model found no supported matches in the ESCO v1.2.1 skill taxonomy.");
    } catch (error) {
      if (controller.signal.aborted) return;
      setSkillExtractionError(error instanceof Error ? error.message : "AI skill extraction could not be completed.");
    } finally {
      if (skillExtractionController.current === controller) {
        skillExtractionController.current = null;
        if (!controller.signal.aborted) setSkillExtractionBusy(false);
      }
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
        next.push({ id: candidate.skill_id, name: candidate.canonical_name, source: candidate.taxonomy_source ?? "ESCO v1.2.1" });
      }
      return next;
    });
    setSkillReviewApplied(true);
    setSkillExtractionNotice(`${chosen.length} supported skill${chosen.length === 1 ? "" : "s"} added to your selected skills${chosen.length < selected.length ? `; ${selected.length - chosen.length} stale suggestion${selected.length - chosen.length === 1 ? " was" : "s were"} skipped` : ""}. The taxonomy IDs will be kept with your session profile.`);
  }

  const recommendedSkills = recommendedSkillOptions;
  const allCandidatesSelected = skillExtractionCandidates.length > 0
    && selectedSkillCandidates.length === skillExtractionCandidates.length;

  const canContinue = activeStep === 0 ? firstName.trim().length > 0 && lastName.trim().length > 0 && email.trim().length > 0
    : activeStep === 1 ? major.trim().length > 0
    : activeStep === 2 ? selectedSkills.length > 0
        : true;

  return (
    <main className={`login-page register-page ${activeStep === null ? "is-welcome" : "is-onboarding"}${activeStep === 7 ? " is-skill-review" : ""}`}>
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
      </section> : activeStep <= lastStep ? <section className="onboarding-stage" aria-live="polite">
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
              <p>Search the ESCO v1.2.1 skill list or start with a few suggestions. Select all that apply.</p>
              <div className="skill-picker">
                <label className="onboarding-label" htmlFor="journey-skill-search">Search skills</label>
                <input ref={skillSearchRef} id="journey-skill-search" className="onboarding-control" type="search" value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="Try Python, data analysis, communication…" autoComplete="off" />
                {skillQuery.trim() && <div className="onboarding-skill-results" role="listbox" aria-label="Skill search results">
                  {skillQuery.trim().length < 2 && <span className="onboarding-skill-message">Enter at least two characters to search ESCO skills.</span>}
                  {skillLoading && <span className="onboarding-skill-message" role="status">Searching ESCO skills…</span>}
                  {!skillLoading && skillOptions.slice(0, 5).map((skill) => <button className="onboarding-skill-result" type="button" key={skill.id} role="option" aria-selected={selectedSkills.some((item) => item.id === skill.id)} onClick={() => addSkill({ id: skill.id, name: skill.name, source: skill.taxonomy_source })}><span>{skill.name}</span><small>ESCO v1.2.1 · {selectedSkills.some((item) => item.id === skill.id) ? "Added" : "Add skill"}</small></button>)}
                  {!skillLoading && skillQuery.trim().length >= 2 && skillOptions.length === 0 && <span className="onboarding-skill-message">{skillLoadError || "No matching ESCO skills found."}</span>}
                  {!skillLoading && skillQuery.trim().length >= 2 && skillOptions.length === 0 && <button className="onboarding-skill-result custom" type="button" onClick={addCustomSkill}><span>Add “{skillQuery.trim()}” as a custom skill</span><small>Add</small></button>}
                </div>}
                {skillLoadError && !skillQuery.trim() && <span className="onboarding-field-hint" role="status">{skillLoadError}</span>}
                <div className="onboarding-recommendations" aria-label="Suggested skills">
                  <span className="onboarding-recommendation-label">SUGGESTED ESCO SKILLS</span>
                  {recommendedSkillLoadError && <span className="onboarding-skill-message" role="status">{recommendedSkillLoadError}</span>}
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
                <div><h2 id="onboarding-ai-skills-heading">Extract skills from your descriptions</h2>                <p>RunPod will read your experience, coursework, project and achievement descriptions, plus work activities and strengths. Names, email, school details, interests, aspirations and learning preferences are not sent. Candidates are matched against the pinned ESCO v1.2.1 English snapshot; this service uses the ESCO classification of the European Commission. The fictional sample contains evidence intended to support up to 10 skill suggestions; the model may return fewer.</p></div>
                <label className="onboarding-ai-consent"><input type="checkbox" checked={skillExtractionConsent} onChange={(event) => setSkillExtractionConsent(event.target.checked)} /><span>I confirm the included descriptions are fictional and consent to send them to RunPod for skill analysis. The app does not save this extraction request; RunPod’s configured data-retention terms apply.</span></label>
                <div className="onboarding-ai-actions">
                  <button className="login-submit onboarding-ai-button" type="button" onClick={() => void extractRegistrationSkills()} disabled={skillExtractionBusy || !skillExtractionConsent} data-testid="button-onboarding-ai-extract">{skillExtractionBusy ? "Understanding your descriptions…" : "Extract skills from my descriptions"}</button>
                  {skillExtractionCandidates.length > 0 && <button className={`onboarding-ai-add${skillReviewApplied ? " is-applied" : ""}`} type="button" onClick={applyRegistrationSkillReview} disabled={skillReviewApplied || !selectedSkillCandidates.length}>{skillReviewApplied ? "✓ Added to my profile" : "Add selected skills to my profile"}</button>}
                </div>
                {skillExtractionBusy && <p className="onboarding-ai-status" role="status">Checking your descriptions against ESCO v1.2.1 and waiting for RunPod (up to 90 seconds)…</p>}
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

            {backendError && <p role="alert">{backendError}</p>}{backendSaving && <p role="status">Saving your profile...</p>}
            <div className="onboarding-actions"><span className="onboarding-note">YOUR CHOICES STAY IN THIS SESSION</span><button ref={continueButtonRef} className="login-submit onboarding-next" type="submit" disabled={!canContinue || backendSaving}><span>{activeStep === lastStep ? "Shape my pathway" : "Continue"}</span><span aria-hidden="true">→</span></button></div>
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
