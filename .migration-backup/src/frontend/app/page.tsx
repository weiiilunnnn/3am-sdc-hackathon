"use client";

import { FormEvent, useState } from "react";

type Summary = { count: number; min: number | null; max: number | null; average: number | null };

export default function Home() {
  const [input, setInput] = useState("12, 7, 3, 21, 9");
  const [result, setResult] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    const values = input.split(",").map((value) => Number(value.trim()));
    if (!values.length || values.some((value) => !Number.isFinite(value))) {
      setError("Enter numbers separated by commas, for example: 12, 7, 3");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "The API request failed.");
      setResult(data as Summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to the backend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">3AM SDC HACKATHON · STARTER APP</p>
        <h1>Your frontend starts here.</h1>
        <p className="intro">This Next.js page sends your numbers to the Python API and shows its response.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="numbers">Numbers, separated by commas</label>
          <input id="numbers" value={input} onChange={(event) => setInput(event.target.value)} />
          <button disabled={loading}>{loading ? "Working…" : "Summarize numbers"}</button>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
        {result && (
          <div className="result" aria-live="polite">
            <h2>API response</h2>
            <dl>
              <div><dt>Count</dt><dd>{result.count}</dd></div>
              <div><dt>Minimum</dt><dd>{result.min}</dd></div>
              <div><dt>Maximum</dt><dd>{result.max}</dd></div>
              <div><dt>Average</dt><dd>{result.average}</dd></div>
            </dl>
          </div>
        )}
        <p className="hint">Backend: FastAPI on <code>127.0.0.1:8000</code></p>
      </section>
    </main>
  );
}
