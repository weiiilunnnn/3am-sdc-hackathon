export async function request<T>(path: string, payload?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: payload === undefined ? "GET" : "POST", signal,
    headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload), cache: "no-store" });
  let data;
  try { data = await response.json(); } catch { throw new Error("Unreadable service response. Check that FastAPI is running."); }
  if (!response.ok) {
    const detail = data.detail;
    throw new Error(Array.isArray(detail) ? detail.map((e: { loc?: string[]; msg?: string }) => `${e.loc?.join(".") ?? "Input"}: ${e.msg ?? "Invalid value"}`).join("; ") : typeof detail === "string" ? detail : "The request could not be completed.");
  }
  return data as T;
}
export function duration(hours: number | null): string {
  if (hours === null) return "Duration not published";
  const minutes = Math.round(hours * 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
}

export function planningTime(estimate: import("./contracts").PlanningEstimate | null): string {
  if (estimate?.scheduled_weeks == null) return "Time unavailable";
  if (estimate.scheduled_weeks === 0) return "No additional study";
  return `~${Number(estimate.scheduled_weeks.toFixed(1)) || "<0.1"} study weeks · app estimate`;
}

export function resourceTime(estimate: import("./contracts").TimeEstimate | null): string {
  if (estimate?.value == null) return "Time unavailable";
  if (estimate.unit === "hour") return `${duration(estimate.value)} · ${estimate.published_by_provider ? "provider’s estimate" : "reviewed app estimate"}`;
  return `Est. ${estimate.value} study ${estimate.unit === "study_day" ? "day" : "week"}${estimate.value === 1 ? "" : "s"} · app rule`;
}
