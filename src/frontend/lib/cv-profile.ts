/** Optional CV-ready profile fields. Registration deliberately does not collect these. */
export type CvEntry = {
  id: string;
  title: string;
  organization: string;
  period: string;
  description: string;
  url: string;
};

export type CvDetails = {
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
  graduationDate: string;
  languages: string;
  additionalEducation: CvEntry[];
  projects: CvEntry[];
  certifications: CvEntry[];
  awards: CvEntry[];
  volunteering: CvEntry[];
  publications: CvEntry[];
};

export type CvCollectionKey = "additionalEducation" | "projects" | "certifications" | "awards" | "volunteering" | "publications";

export const CV_COLLECTIONS: { key: CvCollectionKey; title: string; singular: string }[] = [
  { key: "additionalEducation", title: "Additional education", singular: "Education" },
  { key: "projects", title: "Projects", singular: "Project" },
  { key: "certifications", title: "Certifications", singular: "Certification" },
  { key: "awards", title: "Honours & awards", singular: "Award" },
  { key: "volunteering", title: "Volunteering", singular: "Role" },
  { key: "publications", title: "Publications", singular: "Publication" },
];

export const EMPTY_CV_DETAILS: CvDetails = {
  phone: "", location: "", linkedin: "", github: "", portfolio: "", graduationDate: "", languages: "",
  additionalEducation: [], projects: [], certifications: [], awards: [], volunteering: [], publications: [],
};

/** Defensive decoding: old registration sessions have no cvDetails. */
export function normalizeCvDetails(value: unknown): CvDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...EMPTY_CV_DETAILS };
  const raw = value as Record<string, unknown>;
  const text = (key: string) => typeof raw[key] === "string" ? (raw[key] as string).slice(0, 12000) : "";
  const parsed: CvDetails = {
    ...EMPTY_CV_DETAILS,
    phone: text("phone"), location: text("location"), linkedin: text("linkedin"), github: text("github"),
    portfolio: text("portfolio"), graduationDate: text("graduationDate"), languages: text("languages"),
  };
  for (const { key } of CV_COLLECTIONS) {
    const entries = Array.isArray(raw[key]) ? raw[key] as unknown[] : [];
    parsed[key] = entries.slice(0, 30).flatMap((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const data = entry as Record<string, unknown>;
      const field = (name: keyof CvEntry) => typeof data[name] === "string" ? (data[name] as string).slice(0, 12000) : "";
      return [{ id: field("id") || `${key}-${index}`, title: field("title"), organization: field("organization"),
        period: field("period"), description: field("description"), url: field("url") }];
    });
  }
  return parsed;
}

export function filledCvEntry(item: CvEntry) {
  return Boolean(item.title.trim() || item.organization.trim() || item.description.trim());
}

export function cvEntryId() {
  return `cv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Only export public, HTTPS links. Never embed localhost/test URLs in a CV. */
export function safeCvUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password ||
        !host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") ||
        host === "localhost" || host.startsWith("127.") || host.startsWith("192.168.") ||
        host.startsWith("10.") || host.startsWith("172.16.") || host.startsWith("172.17.") ||
        host.startsWith("172.18.") || host.startsWith("172.19.") || host.startsWith("172.2") ||
        host.startsWith("172.30.") || host.startsWith("172.31.") || host.startsWith("169.254.") ||
        host.includes(":") || host.startsWith("[") || /\s/.test(candidate)) return null;
    return url.href;
  } catch { return null; }
}

/** Basic format validation: avoid obvious errors; never claim to verify a qualification. */
export function validateCvDetails(value: CvDetails): Record<string, string> {
  const errors: Record<string,string> = {};
  const phone = value.phone.trim();
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (!/^[+()0-9.\s-]+$/.test(phone) || digits.length < 7 || digits.length > 15 || phone.length > 30) {
      errors.phone = "Use a real-looking phone format with 7–15 digits (for example +60 12-345 6789).";
    }
  }
  if (value.location.trim().length > 90 || /^https?:\/\//i.test(value.location.trim())) {
    errors.location = "Enter a city or region, not a URL (maximum 90 characters).";
  }
  for (const key of ["linkedin","github","portfolio"] as const) {
    const raw = value[key].trim();
    if (!raw) continue;
    const valid = safeCvUrl(raw);
    if (!valid) { errors[key] = "Enter a public HTTPS URL, not a localhost or placeholder link."; continue; }
    const host = new URL(valid).hostname.toLowerCase().replace(/^www\./, "");
    if (key === "linkedin" && host !== "linkedin.com") errors[key] = "Use your linkedin.com profile URL.";
    if (key === "github" && host !== "github.com") errors[key] = "Use your github.com profile URL.";
    if (raw.length > 260) errors[key] = "Keep this URL below 260 characters.";
  }
  const grad = value.graduationDate.trim();
  if (grad && (!/\b(?:19|20)\d{2}\b/.test(grad) || grad.length > 35)) {
    errors.graduationDate = "Include a four-digit year (for example 2028 or May 2028).";
  }
  const langs = value.languages.split(/[,;\n]/).map((x)=>x.trim()).filter(Boolean);
  if (langs.some((x)=>x.length > 40) || langs.length > 12 || value.languages.length > 350) {
    errors.languages = "Use up to 12 language names, each shorter than 40 characters.";
  }
  for (const { key, singular } of CV_COLLECTIONS) {
    for (const item of value[key]) {
      const id = `${key}.${item.id}`;
      if (!filledCvEntry(item) && !item.period.trim() && !item.url.trim()) continue;
      if (item.title.trim().length < 2 || item.title.length > 120) {
        errors[`${id}.title`] = `Add a descriptive ${singular.toLowerCase()} title (2–120 characters).`;
      }
      if (item.organization.length > 120) errors[`${id}.organization`] = "Keep this name below 120 characters.";
      const period = item.period.trim();
      if (period && (!/\b(?:19|20)\d{2}\b/.test(period) || period.length > 80)) {
        errors[`${id}.period`] = "Include a four-digit year, e.g. 2022–2028 or Jan 2025 – Present.";
      }
      if (item.url.trim() && !safeCvUrl(item.url)) errors[`${id}.url`] = "Use a public HTTPS URL (not a local/test address).";
      if (item.url.length > 260) errors[`${id}.url`] = "Keep this URL below 260 characters.";
      if (item.description.length > 2200) errors[`${id}.description`] = "Keep descriptions below 2,200 characters; use concise bullets.";
    }
  }
  return errors;
}
