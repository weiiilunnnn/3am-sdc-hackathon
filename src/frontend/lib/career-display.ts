/** Presentation only: never changes canonical ESCO labels, IDs or membership. */
const casing: Record<string, string> = { ai: "AI", sql: "SQL", ict: "ICT", etl: "ETL", api: "API", bi: "BI", html: "HTML", css: "CSS", xml: "XML", json: "JSON", python: "Python", javascript: "JavaScript", typescript: "TypeScript" };
const minor = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);
/** Listing display only; keep canonical occupation labels untouched. */
export function displayOccupationTitle(value: string): string {
  const technical: Record<string, string> = { ...casing, it: "IT", ios: "iOS", "3d": "3D", "2d": "2D", cad: "CAD", cnc: "CNC" };
  return displaySkillLabel(value).replace(/[\p{L}\p{N}]+/gu, word => technical[word.toLowerCase()] ?? word);
}
export function displaySkillLabel(value: string): string {
  let index = 0;
  return value.replace(/[\p{L}\p{N}]+/gu, word => {
    const first = index++ === 0;
    const lower = word.toLowerCase();
    if (casing[lower]) return casing[lower];
    if (/[a-z][A-Z]/.test(word) || /^[A-Z\d]{2,}$/.test(word)) return word;
    if (!first && minor.has(lower)) return lower;
    return word[0].toUpperCase() + word.slice(1);
  });
}
