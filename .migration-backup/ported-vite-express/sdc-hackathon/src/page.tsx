import { useState, type FormEvent } from "react";
import { useGetProjectHealth, useSummarizeValues } from "@workspace/api-client-react";

export default function Home() {
  const [input, setInput] = useState("12, 7, 3, 21, 9");
  const [result, setResult] = useState<{
    count: number;
    min: number;
    max: number;
    average: number;
  } | null>(null);
  const [error, setError] = useState("");
  const summarize = useSummarizeValues();
  const health = useGetProjectHealth();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);
    const values = input.split(",").map((value) => Number(value.trim()));
    if (!values.length || values.some((value) => !Number.isFinite(value))) {
      setError("Enter numbers separated by commas, for example: 12, 7, 3");
      return;
    }

    try {
      const data = await summarize.mutateAsync({ data: { values } });
      setResult(data);
    } catch (err) {
      if (err && typeof err === "object" && "data" in err) {
        const data = (err as { data?: { detail?: string } }).data;
        setError(data?.detail ?? "The API request failed.");
      } else {
        setError(err instanceof Error ? err.message : "Could not connect to the backend.");
      }
    }
  }

  return (
    <main className="shell">
      <section className="card" data-testid="card-number-summary">
        <p className="eyebrow" data-testid="text-eyebrow">3AM SDC HACKATHON · STARTER APP</p>
        <h1 data-testid="text-page-title">Your frontend starts here.</h1>
        <p className="intro" data-testid="text-intro">This page sends your numbers to the project API and shows its response.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="numbers">Numbers, separated by commas</label>
          <input
            id="numbers"
            data-testid="input-numbers"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-invalid={Boolean(error)}
          />
          <button type="submit" data-testid="button-summarize" disabled={summarize.isPending}>
            {summarize.isPending ? "Working…" : "Summarize numbers"}
          </button>
        </form>
        {error && <p className="error" role="alert" data-testid="text-summary-error">{error}</p>}
        {result && (
          <div className="result" aria-live="polite" data-testid="panel-summary-result">
            <h2>API response</h2>
            <dl>
              <div><dt>Count</dt><dd data-testid="value-count">{result.count}</dd></div>
              <div><dt>Minimum</dt><dd data-testid="value-minimum">{result.min}</dd></div>
              <div><dt>Maximum</dt><dd data-testid="value-maximum">{result.max}</dd></div>
              <div><dt>Average</dt><dd data-testid="value-average">{result.average}</dd></div>
            </dl>
          </div>
        )}
        <p className="hint" data-testid="status-project-health">
          Backend: project API
          {health.isLoading ? " · checking…" : health.data ? ` · ${health.data.status}: ${health.data.message}` : " · unavailable"}
        </p>
      </section>
    </main>
  );
}
