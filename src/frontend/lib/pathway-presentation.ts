import type { Resource } from "./contracts";
import { duration, resourceTime } from "./future-role-api";

/** Hide absent audit defaults; never turn an unsupported field into a claim. */
export function supportedText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text && !/^(?:-|0)$/i.test(text) && !/\b(?:unknown|unavailable|not (?:available|confirmed|verified|found|supplied|provided|published|known|assessed)|n\/a)\b/i.test(text) ? text : null;
}
export function checkedDate(value?: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) || !Number.isFinite(Date.parse(value))) return null;
  return value.slice(0, 10);
}
export function resourceTiming(resource: Resource): string | null {
  const estimate = resource.time_estimate;
  if (resource.evidence_status !== "verified" || !estimate || estimate.value === null || !Number.isFinite(estimate.value) || estimate.value <= 0) return null;
  if (estimate.basis === "provider_published" && estimate.published_by_provider && estimate.unit === "hour") return resourceTime(estimate);
  if (estimate.basis === "reviewed_app_estimate" && !estimate.published_by_provider) {
    return estimate.unit === "hour" ? `${duration(estimate.value)} · reviewed app estimate` : `Est. ${estimate.value} study ${estimate.unit === "study_day" ? "days" : "weeks"} · reviewed app estimate`;
  }
  if (estimate.basis === "app_rule_of_thumb" && estimate.rule_id && !estimate.published_by_provider && estimate.unit !== "hour") return resourceTime(estimate);
  return null;
}
export function moneyLabel(value?: { amount: number; currency: string } | null): string | null {
  return value && Number.isFinite(value.amount) && value.amount >= 0 && /^[A-Z]{3}$/.test(value.currency) ? value.amount === 0 ? "Free" : `${value.amount} ${value.currency}` : null;
}
