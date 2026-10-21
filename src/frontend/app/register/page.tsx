"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";

const interestOptions = ["Data & analytics", "Artificial intelligence", "Product & business", "Sustainability"];
const experienceOptions = ["Just getting started", "Coursework", "Personal projects", "Internship or work"];

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
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [journeyTransition, setJourneyTransition] = useState(false);
  const [showRegisterIntro, setShowRegisterIntro] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [name, setName] = useState("");
  const [major, setMajor] = useState("");
  const [interest, setInterest] = useState("");
  const [experience, setExperience] = useState("");
  const [message, setMessage] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const majorInputRef = useRef<HTMLInputElement>(null);
  const lastStep = 3;

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
    if (activeStep === 0) nameInputRef.current?.focus();
    if (activeStep === 1) majorInputRef.current?.focus();
  }, [activeStep]);

  function handleNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeStep === null) return;
    if (activeStep < lastStep) setActiveStep(activeStep + 1);
    else setActiveStep(lastStep + 1);
  }

  function startJourney() {
    setJourneyTransition(true);
    setActiveStep(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => setJourneyTransition(false), 900);
  }

  const canContinue = activeStep === 0 ? name.trim().length > 0
    : activeStep === 1 ? major.trim().length > 0
      : activeStep === 2 ? interest.length > 0
        : activeStep === 3 ? experience.length > 0
          : true;

  return (
    <main className={`login-page register-page ${activeStep === null ? "is-welcome" : "is-onboarding"}`}>
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
          <div className="onboarding-topline"><button type="button" className="onboarding-back" onClick={() => setActiveStep(activeStep === 0 ? null : activeStep - 1)}>← <span>{activeStep === 0 ? "Welcome" : "Back"}</span></button><span className="onboarding-count">0{activeStep + 1} <i>/</i> 04</span></div>
          <div className="onboarding-progress" role="progressbar" aria-label="Profile setup progress" aria-valuemin={1} aria-valuemax={4} aria-valuenow={activeStep + 1}><span style={{ width: `${((activeStep + 1) / 4) * 100}%` }} /></div>
          <form key={activeStep} className="onboarding-form onboarding-content" onSubmit={handleNext}>
            {activeStep === 0 && <div className="onboarding-question">
              <span className="onboarding-step-tag">FIRST, THE HUMAN BEHIND THE PATH</span>
              <h1>What should<br />we call you?</h1>
              <p>We’ll use your name to make this journey feel like yours.</p>
              <label className="onboarding-label" htmlFor="journey-name">Your name</label>
              <div className="login-input-wrap onboarding-input"><span aria-hidden="true">◎</span><input ref={nameInputRef} id="journey-name" name="pathwaay-display-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" placeholder="Type your name" required /></div>
            </div>}

            {activeStep === 1 && <div className="onboarding-question">
              <span className="onboarding-step-tag">YOUR STARTING POINT</span>
              <h1>What’s your<br />major or field?</h1>
              <p>Tell us what you’re studying, working in, or curious about.</p>
              <label className="onboarding-label" htmlFor="journey-major">Major or field of study</label>
              <div className="login-input-wrap onboarding-input"><span aria-hidden="true">⌘</span><input ref={majorInputRef} id="journey-major" value={major} onChange={(event) => setMajor(event.target.value)} autoComplete="off" placeholder="e.g. Data Science" required /></div>
              <div className="onboarding-suggestions"><span>TRY</span>{["Data Science", "Computer Science", "Business", "Still exploring"].map((item) => <button type="button" key={item} onClick={() => setMajor(item)}>{item}</button>)}</div>
            </div>}

            {activeStep === 2 && <div className="onboarding-question">
              <span className="onboarding-step-tag">FOLLOW YOUR CURIOSITY</span>
              <h1>What kind of work<br />pulls you in?</h1>
              <p>Choose the area you’d most like to explore first.</p>
              <div className="onboarding-options" role="group" aria-label="Choose an area of interest">
                {interestOptions.map((item, index) => <button type="button" aria-pressed={interest === item} className={`onboarding-option ${interest === item ? "selected" : ""}`} key={item} onClick={() => setInterest(item)}><span className="option-index">0{index + 1}</span><span>{item}</span><span className="option-radio" /></button>)}
              </div>
            </div>}

            {activeStep === 3 && <div className="onboarding-question">
              <span className="onboarding-step-tag">EVERY PATH HAS A FIRST STEP</span>
              <h1>What have you<br />tried so far?</h1>
              <p>There’s no wrong answer. This helps set a useful starting point.</p>
              <div className="onboarding-options" role="group" aria-label="Choose your experience level">
                {experienceOptions.map((item, index) => <button type="button" aria-pressed={experience === item} className={`onboarding-option ${experience === item ? "selected" : ""}`} key={item} onClick={() => setExperience(item)}><span className="option-index">0{index + 1}</span><span>{item}</span><span className="option-radio" /></button>)}
              </div>
            </div>}

            <div className="onboarding-actions"><span className="onboarding-note">YOUR CHOICES STAY IN THIS SESSION</span><button className="login-submit onboarding-next" type="submit" disabled={!canContinue}><span>{activeStep === lastStep ? "Shape my pathway" : "Continue"}</span><span aria-hidden="true">→</span></button></div>
          </form>
        </div>
      </section> : <section className="onboarding-stage" aria-live="polite">
        <div className="onboarding-orbit" aria-hidden="true"><span /><i /><i /><i /></div>
        <ParticleWave />
        <div className="onboarding-scene onboarding-complete">
          <div className="welcome-live-dot" />
          <p className="eyebrow">YOUR FIRST COORDINATES ARE IN</p>
          <h1>Welcome to<br /><span>Pathwaay, {name}.</span></h1>
          <p>You’re exploring <strong>{interest.toLowerCase()}</strong> from a starting point in <strong>{major}</strong>. Your next step is yours to choose.</p>
          <div className="completion-summary"><span>{experience}</span><span>{interest}</span><span>{major}</span></div>
          <Link className="welcome-cta" href="/explorer"><span>Explore career pathways</span><span className="welcome-cta-icon" aria-hidden="true">↗</span></Link>
          <p className="completion-note">This prototype doesn’t save profile details yet.</p>
        </div>
      </section>}

      <footer className="login-footer"><span>PATHWAAY <i>·</i> CAREER EXPLORER</span><span>Build skills for a changing future.</span></footer>
    </main>
  );
}
