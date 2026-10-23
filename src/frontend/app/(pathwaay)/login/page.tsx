"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [showRegisterIntro, setShowRegisterIntro] = useState(true);

  useEffect(() => {
    const introTimer = window.setTimeout(() => setShowRegisterIntro(false), 1600);
    return () => window.clearTimeout(introTimer);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Sign-in is a prototype preview. Account access will be available when authentication is connected.");
  }

  return (
    <main className="login-page">
      <div className="ambient-layer" aria-hidden="true" />
      <header className="login-topbar">
        <Link className="brand" href="/" aria-label="Pathwaay home"><span className="brand-mark">P</span> Pathwaay <span className="brand-note">CAREER EXPLORER</span></Link>
        <Link className="login-back-link" href="/register">Register <span aria-hidden="true">↗</span></Link>
      </header>
      {showRegisterIntro && <div className="register-intro" aria-hidden="true"><span className="register-intro-mark">P</span><span className="register-intro-word">Pathwaay.</span></div>}

      <section className="login-layout" aria-labelledby="login-title">
        <div className="login-story">
          <div className="login-orbit" aria-hidden="true">
            <span className="login-orbit-core" />
            <span className="login-orbit-ring login-orbit-ring-one"><i /></span>
            <span className="login-orbit-ring login-orbit-ring-two"><i /></span>
            <span className="login-orbit-ring login-orbit-ring-three"><i /></span>
          </div>
          <p className="eyebrow">YOUR FUTURE, IN MOTION</p>
          <h1 id="login-title">Pick up where<br /><span>possibility begins.</span></h1>
          <p className="login-story-copy">Keep your career path, SDG connections and future skill bets in one place.</p>

          <div className="login-signal-card">
            <span className="small-label">PATHWAAY / LIVE SIGNAL</span>
            <div className="login-signal-line"><span className="signal-dot" /><span>Career clarity</span><strong>IN PROGRESS</strong></div>
            <div className="signal-track"><span /></div>
            <div className="login-signal-foot"><span>Skills you can build</span><span>Futures you can compare</span></div>
          </div>
          <div className="login-story-foot"><span className="login-foot-mark">✳</span><span>Designed for curious minds shaping meaningful work.</span></div>
        </div>

        <div className="login-card">
          <div className="login-card-heading">
            <span className="login-lock" aria-hidden="true">↗</span>
            <p className="eyebrow">MEMBER ACCESS</p>
            <h2>Welcome back</h2>
            <p>Sign in to continue your pathway.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="login-email">Email address</label>
            <div className="login-input-wrap"><span aria-hidden="true">✉</span><input id="login-email" name="email" type="email" defaultValue="alantan@example.com" placeholder="you@example.com" autoComplete="email" required /></div>

            <div className="login-password-label"><label htmlFor="login-password">Password</label><button type="button" className="login-text-button" onClick={() => setMessage("Password recovery will be available when authentication is connected.")}>Forgot password?</button></div>
            <div className="login-input-wrap"><span aria-hidden="true">⌑</span><input id="login-password" name="password" type={showPassword ? "text" : "password"} defaultValue="DemoOnly123!" placeholder="Enter your password" autoComplete="current-password" required /><button type="button" className="password-visibility" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "HIDE" : "SHOW"}</button></div>

            <label className="remember-choice"><input type="checkbox" name="remember" /><span className="remember-box" aria-hidden="true" /><span>Keep me signed in</span></label>
            <button className="login-submit" type="submit"><span>Sign in</span><span aria-hidden="true">→</span></button>
            <p className="login-form-note" role="status" aria-live="polite">{message || "This demo sign-in does not create or access an account yet."}</p>
          </form>

          <div className="login-divider"><span>NEW TO PATHWAAY?</span></div>
          <Link className="register-button" href="/register"><span>Create account</span><span aria-hidden="true">→</span></Link>
          <Link className="login-explore-link" href="/home">Open the skills workspace <span aria-hidden="true">↗</span></Link>
          <p className="login-privacy-note"><span aria-hidden="true">◈</span> Your career decisions stay yours. Explore at your own pace.</p>
        </div>
      </section>

    </main>
  );
}
