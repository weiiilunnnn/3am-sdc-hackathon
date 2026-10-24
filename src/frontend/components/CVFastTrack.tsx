"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { PATHWAAY_PROFILE_HANDOFF_KEY, PATHWAAY_PROFILE_UPDATED_EVENT, type PathwaayRegistrationProfile } from "@/lib/pathwaay-profile";
import "./cv-fast-track.css";

type Skill = {
  original_text: string; canonical_name: string; esco_uri: string | null;
  source_version: string | null; taxonomy_source: string;
  legacy_skill_id: string | null; match_status: string; evidence: string;
};
type Experience = { title: string; company: string; timeframe: string; description: string };
type Fields = {
  full_name: string; email: string; major: string; university: string;
  education_level: string; education_record: string; profile_summary: string;
};
type ResponseData = {
  status: "review_required"; fields: Fields; experiences: Experience[]; projects: string[];
  certifications: string[]; achievements: string[]; skills: Skill[]; warnings: string[];
  esco: { loaded: boolean; version: string | null; concept_count: number; message: string };
};
type Stage = "choose" | "loading" | "review";
type CVJobStart = { job_id: string; status: "processing" };
type CVJobStatus = { status: "processing" | "completed" | "failed"; result?: ResponseData; error?: string };

async function serverJSON<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  let data: unknown;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const detail = data && typeof data === "object" && "detail" in data ? (data as {detail?: unknown}).detail : null;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${response.status}).`);
  }
  return data as T;
}

// Each poll is a short request; no single browser-to-Next proxy request stays
// open for the 90-second RunPod model call.
async function awaitCVJob(jobId: string): Promise<ResponseData> {
  if (!jobId || !/^[A-Za-z0-9_-]{16,80}$/.test(jobId)) {
    throw new Error("CV extraction did not return a valid job ID.");
  }
  for (let attempt = 0; attempt < 90; attempt++) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 1500));
    const update = await serverJSON<CVJobStatus>(
      `/api/profiles/extract-registration-cv-async/${encodeURIComponent(jobId)}`,
      { method: "GET" },
    );
    if (update.status === "completed") {
      if (!update.result) throw new Error("CV extraction completed without a profile draft.");
      return update.result;
    }
    if (update.status === "failed") {
      throw new Error(update.error || "CV extraction failed on the server.");
    }
    if (update.status !== "processing") {
      throw new Error("The server returned an unexpected CV extraction status.");
    }
  }
  throw new Error("CV extraction has not completed. Check that the backend is running before trying again.");
}

function nameParts(name: string): [string, string] {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return [parts[0] || "", parts.slice(1).join(" ")];
}

function educationLevel(value: string): string {
  const v = value.toLocaleLowerCase();
  if (v.includes("bachelor") || v.includes("bsc")) return "Bachelor’s degree";
  if (v.includes("master") || v.includes("phd") || v.includes("doctor")) return "Postgraduate";
  if (v.includes("diploma")) return "Diploma";
  if (v.includes("certificat")) return "Certificate";
  if (v.includes("second") || v.includes("high school")) return "Secondary";
  return "Other";
}

export default function CVFastTrack({ onManual, onBack }: { onManual: () => void; onBack: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<ResponseData | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fields, setFields] = useState<Fields | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [projects, setProjects] = useState("");
  const [certifications, setCertifications] = useState("");
  const [achievements, setAchievements] = useState("");
  const [aspiration, setAspiration] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [matching, setMatching] = useState(false);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setNotice("");
    if (chosen && (!/\.(pdf|docx)$/i.test(chosen.name) || chosen.size === 0 || chosen.size > 2 * 1024 * 1024)) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setNotice("Choose a non-empty, text-based PDF or DOCX smaller than 2 MB.");
      return;
    }
    setFile(chosen);
  }

  async function extract() {
    if (!file || !consent) {
      setNotice("Select a CV and agree to sending its text to RunPod for extraction.");
      return;
    }
    setNotice("");
    setStage("loading");
    try {
      const started = await serverJSON<CVJobStart>("/api/profiles/extract-registration-cv-async", {
        method: "POST", headers: {
          "Content-Type": file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
          "X-Filename": file.name, "X-CV-Processing-Consent": "true",
        }, body: file,
      });
      const data = await awaitCVJob(started.job_id);
      const [first, last] = nameParts(data.fields.full_name);
      setResult(data);
      setFields(data.fields);
      setFirstName(first);
      setLastName(last);
      setSkills(data.skills);
      setExperiences(data.experiences);
      setProjects(data.projects.join("\n"));
      setCertifications(data.certifications.join("\n"));
      setAchievements(data.achievements.join("\n"));
      setStage("review");
    } catch (error) {
      setStage("choose");
      const detail = error instanceof Error ? error.message : "An unexpected error occurred.";
      setNotice(`We could not extract your CV. ${detail} Please upload a different résumé or continue with manual registration.`);
    }
  }

  async function rematchSkills() {
    setMatching(true);
    setNotice("");
    try {
      const labels = skills.map(item => item.original_text.trim()).filter(Boolean);
      if (!labels.length) { setMatching(false); return; }
      const data = await serverJSON<{skills: Skill[]; esco: ResponseData["esco"]}>("/api/profiles/normalise-registration-skills", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skills: labels }),
      });
      setSkills(data.skills);
      setResult(old => old ? { ...old, esco: data.esco } : old);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Skill recheck failed.");
    } finally { setMatching(false); }
  }

  function saveReviewed() {
    if (!fields || !firstName.trim()) {
      setNotice("Please review and enter at least your first name.");
      return;
    }
    if (!fields.major.trim() && !fields.education_record.trim() && !experiences.length && !projects.trim() && !skills.length) {
      setNotice("Please provide at least education, a project, experience, or a skill before continuing.");
      return;
    }
    const selected = skills.filter(item => item.original_text.trim());
    const chosenSkills = selected.map(item => item.legacy_skill_id
      ? item.original_text.trim() : (item.esco_uri ? item.canonical_name : item.original_text.trim()));
    const profile: PathwaayRegistrationProfile = {
      firstName: firstName.trim(), lastName: lastName.trim(), email: fields.email.trim(),
      educationLevel: educationLevel(fields.education_level || fields.education_record),
      university: fields.university.trim(), major: fields.major.trim(), cgpa: "", schoolAwards: "",
      experiences: experiences.map((item, index) => ({...item, id: `cv-experience-${index + 1}`})),
      skills: chosenSkills,
      skillLinks: selected.map((item, index) => ({
        name: chosenSkills[index], skill_id: item.legacy_skill_id ?? null,
        taxonomy_source: item.taxonomy_source,
        esco_uri: item.esco_uri, esco_label: item.esco_uri ? item.canonical_name : null,
        source_version: item.source_version, original_text: item.original_text,
      })),
      educationRecord: fields.education_record.trim(), volunteering: "", projects: projects.trim(),
      certifications: certifications.trim(), achievements: achievements.trim(), interests: "",
      workActivities: "", strengths: "", skillsToDevelop: "", aspiration: aspiration.trim(),
      profileSummary: fields.profile_summary.trim(), weeklyHours: "", learningBudget: "", learningMode: "",
    };
    try {
      window.sessionStorage.setItem(PATHWAAY_PROFILE_HANDOFF_KEY, JSON.stringify(profile));
      window.dispatchEvent(new CustomEvent(PATHWAAY_PROFILE_UPDATED_EVENT, { detail: profile }));
      router.replace("/profile");
    } catch {
      setNotice("Unable to save this profile in your browser session. Check browser storage settings.");
    }
  }

  return <section className="cvft-page">
    <div className="cvft-container">
      <button type="button" className="cvft-back" onClick={onBack}>← Back</button>
      {stage === "choose" && <section className="cvft-card" aria-label="Upload your CV">
        <p className="cvft-eyebrow">THE FAST TRACK</p>
        <h1>Start with your CV.</h1>
        <p>Skip typing every detail. We’ll extract your existing experience, education and skills, then let you check everything before entering Pathwaay.</p>
        <div className="cvft-upload">
          <span aria-hidden="true" className="cvft-fileicon">↥</span>
          <label htmlFor="cvft-file">Choose your CV</label>
          <input id="cvft-file" ref={inputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={selectFile} aria-invalid={!!notice} aria-describedby={notice ? "cvft-upload-error" : undefined}/>
          <small>PDF or DOCX · Up to 2 MB · Text-based documents only</small>
          {file && <strong>{file.name}</strong>}
        </div>
        {notice && <div id="cvft-upload-error" className="cvft-error cvft-upload-error" role="alert" aria-live="assertive">
          <strong>Unable to extract CV</strong>
          <span>{notice}</span>
        </div>}
        <label className="cvft-checkbox"><input type="checkbox" checked={consent} onChange={(e: ChangeEvent<HTMLInputElement>) => setConsent(e.target.checked)}/><span>I agree to my CV text being processed by RunPod for profile extraction. I’ll review the results before they are saved in this browser session.</span></label>
        <button type="button" className="cvft-primary" disabled={!file || !consent} onClick={extract}>Extract my CV →</button>
        <div className="cvft-divider">or</div>
        <button type="button" className="cvft-secondary" onClick={onManual}>Continue with manual registration</button>
        <p className="cvft-small">Uploads are processed temporarily; they are not stored by this endpoint. Scanned images are not currently supported.</p>
      </section>}
      {stage === "loading" && <section className="cvft-card cvft-loading" role="status" aria-live="polite">
        <span className="cvft-spinner" aria-hidden="true"/>
        <p className="cvft-eyebrow">READING YOUR CV</p>
        <h1>Building your first profile draft.</h1>
        <p>Checking the document, extracting evidence and matching skills against the available ESCO reference. No information will be saved until you confirm it.</p>
      </section>}
      {stage === "review" && fields && result && <section className="cvft-card cvft-review" aria-label="Review extracted profile">
        <p className="cvft-eyebrow">REVIEW BEFORE CONTINUING</p>
        <h1>Here’s what we found.</h1>
        <p>These are suggestions extracted from your CV. Please correct missing or inaccurate information before creating your profile.</p>
        <div className="cvft-grid">
          <label>First name<input value={firstName} onChange={(e: ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)} /></label>
          <label>Last name<input value={lastName} onChange={(e: ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)} /></label>
          <label>Email<input type="email" value={fields.email} onChange={(e: ChangeEvent<HTMLInputElement>) => setFields({...fields, email:e.target.value})} /></label>
          <label>University<input value={fields.university} onChange={(e: ChangeEvent<HTMLInputElement>) => setFields({...fields,university:e.target.value})} /></label>
          <label>Field of study<input value={fields.major} onChange={(e: ChangeEvent<HTMLInputElement>) => setFields({...fields,major:e.target.value})} /></label>
          <label>Education level<input value={fields.education_level} onChange={(e: ChangeEvent<HTMLInputElement>) => setFields({...fields,education_level:e.target.value})} /></label>
        </div>
        <label className="cvft-wide">Education details<textarea rows={3} value={fields.education_record} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFields({...fields,education_record:e.target.value})}/></label>
        <label className="cvft-wide">Professional summary<textarea rows={3} value={fields.profile_summary} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFields({...fields,profile_summary:e.target.value})}/></label>
        <h2>Experience</h2>
        {experiences.map((item,index)=><div className="cvft-experience" key={index}>
          <div className="cvft-grid">
            {(["title","company","timeframe"] as const).map(key=><label key={key}>{key}<input value={item[key]} onChange={(e: ChangeEvent<HTMLInputElement>) =>setExperiences(old=>old.map((v,i)=>i===index?{...v,[key]:e.target.value}:v))}/></label>)}
          </div>
          <label className="cvft-wide">Description<textarea rows={2} value={item.description} onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>setExperiences(old=>old.map((v,i)=>i===index?{...v,description:e.target.value}:v))}/></label>
          <button type="button" className="cvft-link" onClick={()=>setExperiences(old=>old.filter((_,i)=>i!==index))}>Remove experience</button>
        </div>)}
        <button type="button" className="cvft-secondary" onClick={()=>setExperiences(old=>[...old,{title:"",company:"",timeframe:"",description:""}])}>+ Add experience</button>
        <div className="cvft-section-heading"><h2>Skills</h2><button type="button" className="cvft-link" disabled={matching} onClick={rematchSkills}>{matching?"Checking…":"Recheck ESCO matches"}</button></div>
        <p className="cvft-small">{result.esco.message}. Official ESCO URIs appear only for verified matches. Other skills remain local or custom.</p>
        <div className="cvft-skills">{skills.map((skill,index)=><div className="cvft-skill" key={index}>
          <input aria-label={`Skill ${index+1}`} value={skill.original_text} onChange={(e: ChangeEvent<HTMLInputElement>) =>setSkills(old=>old.map((item,i)=>i===index?{...item,original_text:e.target.value,canonical_name:e.target.value,esco_uri:null,legacy_skill_id:null,taxonomy_source:"Custom",match_status:"unmatched"}:item))}/>
          <small>{skill.esco_uri ? `ESCO: ${skill.canonical_name}` : skill.match_status==="local_only" ? "Local vocabulary · not ESCO" : "Unmatched · review"}</small>
          <button type="button" aria-label={`Remove skill ${index+1}`} onClick={()=>setSkills(old=>old.filter((_,i)=>i!==index))}>×</button>
        </div>)}</div>
        <div className="cvft-add-skill"><input aria-label="Add a skill" value={newSkill} onChange={(e: ChangeEvent<HTMLInputElement>) =>setNewSkill(e.target.value)} placeholder="Add a missing skill"/><button type="button" className="cvft-secondary" disabled={!newSkill.trim()} onClick={()=>{setSkills(old=>[...old,{original_text:newSkill.trim(),canonical_name:newSkill.trim(),esco_uri:null,source_version:null,taxonomy_source:"Custom",legacy_skill_id:null,match_status:"unmatched",evidence:""}]);setNewSkill("");}}>Add</button></div>
        <label className="cvft-wide">Projects<textarea rows={4} value={projects} onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>setProjects(e.target.value)}/></label>
        <label className="cvft-wide">Certifications<textarea rows={2} value={certifications} onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>setCertifications(e.target.value)}/></label>
        <label className="cvft-wide">Achievements<textarea rows={2} value={achievements} onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>setAchievements(e.target.value)}/></label>
        <label className="cvft-wide">Career aspiration (optional — not inferred from CV)<input value={aspiration} onChange={(e: ChangeEvent<HTMLInputElement>) =>setAspiration(e.target.value)} placeholder="What career would you like to explore?"/></label>
        {result.warnings.length>0 && <div className="cvft-warnings"><strong>Review notes</strong>{result.warnings.map((warning,i)=><p key={i}>{warning}</p>)}</div>}
        <div className="cvft-actions"><button type="button" className="cvft-secondary" onClick={()=>setStage("choose")}>Upload a different CV</button><button type="button" className="cvft-primary" onClick={saveReviewed}>Confirm & enter Pathwaay →</button></div>
      </section>}
      {stage === "review" && notice && <p className="cvft-error" role="alert">{notice}</p>}
    </div>
  </section>;
}
