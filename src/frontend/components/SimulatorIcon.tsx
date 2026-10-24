export type SimulatorIconKind = "career" | "skill" | "goal" | "break" | "edit" | "remove" | "plus" | "close" | "left" | "right" | "study" | "family" | "relocation" | "hobbies" | "business" | "savings" | "return";
const paths: Record<SimulatorIconKind, string> = {
  career:"M8 7V4h8v3M3 7h18v14H3zM3 11c5 5 13 5 18 0M10 13h4",
  skill:"m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3z",
  goal:"M12 21V3m0 1h8l-2 4 2 4h-8M6 21h12",
  break:"M8 6v12M16 6v12",edit:"m4 16 12-12 4 4L8 20H4zM13 7l4 4",
  remove:"M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
  plus:"M12 4v16M4 12h16",close:"m5 5 14 14M19 5 5 19",
  left:"m15 5-7 7 7 7",right:"m9 5 7 7-7 7",
  study:"m2 9 10-6 10 6-10 6zM6 12v6c4 4 8 4 12 0v-6M22 9v8",
  family:"m3 11 9-8 9 8v10H3zM9 21v-8h6v8",
  relocation:"m3 10 18-7-7 18-3-8zM11 13l6-6",
  hobbies:"M12 3a9 9 0 1 0 0 18c5 0-1-5 3-5h3c6-5 1-13-6-13M7 8h.1M13 6h.1M6 13h.1M17 9h.1",
  business:"m12 3 7 3-3 9-5 2-4-4zM7 13l-4 1v5l6-2M11 17l-1 4h5l1-6",
  savings:"M4 10c0-5 13-5 14 0l3 2-3 3-1 5h-3v-3H8v3H5l-1-5H2v-5zM9 5V3h5M15 10h.1",
  return:"M3 10a9 9 0 1 1 1 8M3 3v7h7",
};
export default function SimulatorIcon({kind}:{kind:SimulatorIconKind}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[kind]}/></svg>;
}
