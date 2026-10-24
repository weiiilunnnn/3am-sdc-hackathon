import type { CareerAnalysis } from "./career-analysis";

export type AnalysisJob = {
  job_id: string | null; evidence_key: string;
  status: "submitting" | "queued" | "in_progress" | "completed" | "failed" | "expired" | "unavailable";
  poll_after_ms: number; expires_at: number | null; error_code: string | null;
  analysis: CareerAnalysis | null; retryable?: boolean; retry_blocked_reason?: string | null;
};
type Inputs = { role_id: string; recognised_skill_ids: string[] };
type Transport = (path: string, payload: unknown, signal: AbortSignal) => Promise<AnalysisJob>;

const pause = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const abort = () => { clearTimeout(timer); reject(new Error("Analysis polling stopped")); };
  const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
  if (signal.aborted) abort(); else signal.addEventListener("abort", abort, {once: true});
});

/** Start once; every subsequent request can only read that evidence-bound job. */
export async function awaitCareerAnalysis(inputs: Inputs, evidenceKey: string, signal: AbortSignal,
  transport: Transport, sleep = pause, now = Date.now,
  options: { retryJobId?: string; onJob?: (job: AnalysisJob) => void } = {}): Promise<CareerAnalysis | null> {
  const deadline = now() + 300_000;
  if (signal.aborted) return null;
  let job = await transport("/api/v2/roles/analysis/jobs", options.retryJobId
    ? {...inputs, retry_failed: true, retry_job_id: options.retryJobId} : inputs, signal);
  while (!signal.aborted && now() < deadline) {
    if (job.evidence_key !== evidenceKey) return null;
    options.onJob?.(job);
    if (job.status === "completed") {
      const analysis = job.analysis;
      return analysis?.evidence_key === evidenceKey && analysis.role_id === inputs.role_id ? analysis : null;
    }
    if (!["submitting", "queued", "in_progress"].includes(job.status) || !job.job_id) return null;
    if (job.expires_at !== null && job.expires_at * 1000 <= now()) return null;
    await sleep(Math.min(5000, Math.max(2000, job.poll_after_ms)), signal);
    if (signal.aborted || now() >= deadline) return null;
    job = await transport("/api/v2/roles/analysis/jobs/status", {...inputs,
      job_id: job.job_id, evidence_key: evidenceKey}, signal);
  }
  return null;
}
