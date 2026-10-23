export type PathwayIconKind = "book" | "course" | "video" | "code" | "award" | "monitor" | "file" | "clock";
export function resourceAppearance(type: string | null | undefined): { icon: PathwayIconKind; label?: string } {
  switch (type) {
    case "course": return { icon: "course", label: "Online course" };
    case "video": return { icon: "video", label: "Video" };
    case "documentation": return { icon: "book", label: "Documentation" };
    case "article": return { icon: "file", label: "Article" };
    case "tutorial": return { icon: "book", label: "Tutorial" };
    case "exercise": case "coding": return { icon: "code", label: "Exercise" };
    default: return { icon: "book" };
  }
}
export default function PathwayIcon({ kind }: { kind: PathwayIconKind }) {
  const paths = {
    book: <><path d="M12 5C8 2 4 3 2 4v16c3-2 6-2 10 0 4-2 7-2 10 0V4c-3-2-6-2-10 1Zm0 0v15" /></>,
    course: <><path d="m2 8 10-5 10 5-10 5L2 8Zm4 3v7c4 3 8 3 12 0v-7m4-3v9" /></>,
    video: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4V8Z" /></>,
    code: <><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18" /></>,
    award: <><circle cx="12" cy="8" r="6" /><circle cx="12" cy="8" r="3" /><path d="m8 13-2 9 6-3 6 3-2-9" /></>,
    monitor: <><rect x="3" y="3" width="18" height="14" rx="1" /><path d="M8 21h8m-4-4v4" /></>,
    file: <><path d="M5 2h10l5 5v15H5V2Zm9 0v6h6M9 12h7m-7 4h7" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[kind]}</svg>;
}
