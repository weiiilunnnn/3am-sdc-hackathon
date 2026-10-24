"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BriefcaseBusiness,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coffee,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Palette,
  Pencil,
  PiggyBank,
  Plane,
  Plus,
  RefreshCcw,
  Rocket,
  Sparkles,
  TrendingUp,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const theme = {
  navy: "#081433",
  deepNavy: "#152238",
  muted: "#46536D",
  rose1: "#F04D7A",
  rose2: "#E00046",
  soft: "#FFF2F6",
  soft2: "#FDE7EE",
  line: "#F5CBD6",
  border: "#E5E8F0",
  page: "#fbfbfc",
} as const;

type NodeType = "career" | "life";
type StartingPoint =
  | "Final Year Student"
  | "Fresh Graduate"
  | "Junior UX Designer"
  | "Junior Data Analyst"
  | "Marketing Executive";

type TimelineNode = {
  id: string;
  title: string;
  type: NodeType;
  time: string;
  subtitle: string;
  targetYear: number;
  durationMonths?: number;
  lifeGoalKey?: string;
  icon?: LucideIcon;
};

type CareerTemplate = {
  label: StartingPoint;
  nodes: TimelineNode[];
};

type LifeGoalOption = {
  key: string;
  title: string;
  icon: LucideIcon;
  chapterType: string;
};

type ChapterPlan = {
  title: string;
  eyebrow: string;
  meaning: string;
  focusTitle: string;
  focus: string[];
  skillsTitle: string;
  skills: string[];
  evidenceTitle: string;
  evidence: string[];
  actionTitle: string;
  action: string;
  recommended?: string;
};

const startingOptions: StartingPoint[] = [
  "Final Year Student",
  "Fresh Graduate",
  "Junior UX Designer",
  "Junior Data Analyst",
  "Marketing Executive",
];

const careerTemplates: Record<StartingPoint, CareerTemplate> = {
  "Final Year Student": {
    label: "Final Year Student",
    nodes: [
      career("student", "Final Year Student", 0, "Building portfolio foundation"),
      career("junior-ux", "Junior UX Designer", 1, "First full-time design role"),
      career("ux", "UX Designer", 3, "Owns design tasks and user flows"),
      career("senior-ux", "Senior UX Designer", 5, "Leads product design decisions"),
      career("lead-ux", "Product Design Lead", 8, "Guides design strategy and team direction"),
    ],
  },
  "Fresh Graduate": {
    label: "Fresh Graduate",
    nodes: [
      career("fresh-grad", "Fresh Graduate", 0, "Choosing the first career platform"),
      career("junior-ux", "Junior UX Designer", 1, "First full-time design role"),
      career("ux", "UX Designer", 3, "Owns design tasks and user flows"),
      career("senior-ux", "Senior UX Designer", 5, "Leads product design decisions"),
      career("lead-ux", "Product Design Lead", 8, "Guides design strategy and team direction"),
    ],
  },
  "Junior UX Designer": {
    label: "Junior UX Designer",
    nodes: [
      career("junior-ux", "Junior UX Designer", 0, "First full-time design role"),
      career("ux", "UX Designer", 2, "Owns design tasks and user flows"),
      career("senior-ux", "Senior UX Designer", 4, "Leads product design decisions"),
      career("product-designer", "Product Designer II", 6, "Shapes product direction with evidence"),
      career("lead-ux", "Product Design Lead", 8, "Guides design strategy and team direction"),
    ],
  },
  "Junior Data Analyst": {
    label: "Junior Data Analyst",
    nodes: [
      career("fresh-grad", "Fresh Graduate", 0, "Building employability and tool confidence"),
      career("junior-data", "Junior Data Analyst", 1, "Learns reporting and business context"),
      career("data-analyst", "Data Analyst", 3, "Owns analysis and dashboard delivery"),
      career("senior-data", "Senior Data Analyst", 5, "Leads insight quality and stakeholder decisions"),
      career("analytics-lead", "Analytics Lead", 8, "Guides analytics strategy and team standards"),
    ],
  },
  "Marketing Executive": {
    label: "Marketing Executive",
    nodes: [
      career("marketing-exec", "Marketing Executive", 0, "Runs campaigns and learns audience signals"),
      career("digital-specialist", "Digital Marketing Specialist", 1, "Builds channel expertise and reporting habits"),
      career("growth-analyst", "Growth Marketing Analyst", 3, "Connects campaigns, data, and experiments"),
      career("marketing-manager", "Marketing Manager", 5, "Leads plans, budgets, and campaign teams"),
      career("head-growth", "Head of Growth", 8, "Owns growth strategy and business outcomes"),
    ],
  },
};

const lifeGoalOptions: LifeGoalOption[] = [
  { key: "emergency-savings", title: "Build emergency savings", icon: PiggyBank, chapterType: "Stability Chapter" },
  { key: "family-planning", title: "Get married / family planning", icon: Home, chapterType: "Family Planning Chapter" },
  { key: "investing", title: "Start investing", icon: TrendingUp, chapterType: "Financial Confidence Chapter" },
  { key: "study-again", title: "Study again", icon: GraduationCap, chapterType: "Upskilling / Education Chapter" },
  { key: "health-break", title: "Take a health or burnout break", icon: HeartPulse, chapterType: "Recovery Chapter" },
  { key: "side-business", title: "Start a side business", icon: Rocket, chapterType: "Entrepreneurship Chapter" },
  { key: "relocate", title: "Relocate overseas", icon: Plane, chapterType: "Relocation Chapter" },
  { key: "care-family", title: "Care for family", icon: Users, chapterType: "Caregiving Chapter" },
  { key: "hobbies", title: "Pursue hobbies seriously", icon: Palette, chapterType: "Creative Identity Chapter" },
  { key: "retirement", title: "Plan for retirement", icon: Landmark, chapterType: "Long-Range Planning Chapter" },
  { key: "career-break", title: "Take a 6-month career break", icon: Coffee, chapterType: "Career Break Chapter" },
  { key: "return-work", title: "Return to work after a break", icon: RefreshCcw, chapterType: "Comeback Chapter" },
];

const careerPlans: Record<string, ChapterPlan> = {
  "Junior UX Designer": {
    title: "Junior UX Designer",
    eyebrow: "First full-time design role",
    meaning: "You are entering your first professional design environment and learning how real product teams work.",
    focusTitle: "Main focus",
    focus: ["Learn design process inside a team", "Build confidence in user flows and wireframes", "Understand stakeholder feedback"],
    skillsTitle: "Skills to build",
    skills: ["Figma", "User research basics", "Wireframing", "Usability testing"],
    evidenceTitle: "Portfolio evidence",
    evidence: ["1 complete case study", "Before/after design iteration", "User problem statement"],
    actionTitle: "Suggested next action",
    action: "Update your Living Portfolio with one project that shows your design thinking process.",
  },
};

const lifePlans: Record<string, Partial<ChapterPlan>> = {
  "study-again": {
    meaning: "Taking time to study may slow short-term job progression, but it can improve long-term specialisation and career mobility.",
    focus: ["Reduced full-time work experience during study period", "Possible income pause", "Skills may become outdated if not applied"],
    skills: ["Maintain one active portfolio project", "Choose study topics that connect to your target role", "Keep your Living Portfolio updated monthly"],
    evidence: ["Coursework project", "Certification", "Case study", "Reflection on new skills"],
    action: "Choose one study-related project and turn it into a portfolio case study.",
    recommended: "Flexible, hybrid, or learning-friendly roles.",
  },
  "emergency-savings": {
    meaning: "This chapter prioritises financial stability before taking career risks such as switching jobs, relocating, or joining a startup.",
    focus: ["Career moves may need stronger salary certainty", "Riskier roles may need to wait until savings are stable"],
    skills: ["Target roles with stable salary, clear benefits, and predictable workload", "Build job-search confidence before making a major move"],
    evidence: ["Updated resume", "Clear salary benchmark notes", "Portfolio project tied to employability"],
    action: "Shortlist three stable roles and compare salary, benefits, learning exposure, and workload.",
    recommended: "Stable entry-level role, graduate programme, or structured corporate environment.",
  },
  "side-business": {
    meaning: "This can build ownership, sales, product, and customer understanding, but may increase time pressure.",
    focus: ["Time pressure can affect full-time performance", "Unclear boundaries may reduce learning energy"],
    skills: ["Choose roles that provide learning, customer exposure, and manageable work-life balance", "Capture business experiments as career evidence"],
    evidence: ["Customer interviews", "Landing page or campaign results", "Revenue or learning metrics"],
    action: "Define one small business experiment that can become portfolio evidence within 30 days.",
    recommended: "Hybrid role, startup-friendly role, product/marketing/customer-facing role.",
  },
};

function career(id: string, title: string, targetYear: number, subtitle: string): TimelineNode {
  return { id, title, time: yearLabel(targetYear), subtitle, targetYear, type: "career" };
}

function yearLabel(year: number) {
  return year === 0 ? "Now" : `Year ${year}`;
}

function sortTimelineNodes(nodes: TimelineNode[]) {
  return [...nodes].sort((a, b) => {
    if (a.targetYear !== b.targetYear) return a.targetYear - b.targetYear;
    if (a.type !== b.type) return a.type === "career" ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

function createLifeNode(option: LifeGoalOption, targetYear: number): TimelineNode {
  return {
    id: `life-${option.key}`,
    title: option.title,
    type: "life",
    time: yearLabel(targetYear),
    subtitle: option.chapterType,
    targetYear,
    durationMonths: getDefaultDurationMonths(option.key),
    lifeGoalKey: option.key,
    icon: option.icon,
  };
}

function getLifeOption(key?: string) {
  return lifeGoalOptions.find((item) => item.key === key);
}

function getDefaultDurationMonths(key?: string) {
  const durations: Record<string, number> = {
    "study-again": 24,
    "side-business": 12,
    "health-break": 6,
    relocate: 12,
    "care-family": 12,
    hobbies: 6,
    retirement: 60,
    "career-break": 6,
    "family-planning": 12,
    "emergency-savings": 12,
    investing: 12,
    "return-work": 6,
  };

  if (!key || key.startsWith("custom-")) return 12;
  return durations[key] ?? 12;
}

function parseDurationInput(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(120, parsed);
}

function getCareerPlan(node: TimelineNode): ChapterPlan {
  return careerPlans[node.title] ?? {
    title: node.title,
    eyebrow: node.subtitle,
    meaning: "This stage is about turning your current profile into stronger career evidence for the next role.",
    focusTitle: "Main focus",
    focus: ["Clarify role expectations", "Build consistent work habits", "Collect evidence from real tasks"],
    skillsTitle: "Skills to build",
    skills: ["Communication", "Problem framing", "Tool confidence", "Portfolio storytelling"],
    evidenceTitle: "Portfolio evidence",
    evidence: ["Project summary", "Measurable outcome", "Reflection on decisions"],
    actionTitle: "Suggested next action",
    action: "Add one fresh achievement or project note to your Living Portfolio this week.",
  };
}

function getLifePlan(node: TimelineNode): ChapterPlan {
  const option = getLifeOption(node.lifeGoalKey);
  const mapped = node.lifeGoalKey ? lifePlans[node.lifeGoalKey] : undefined;

  return {
    title: node.title,
    eyebrow: option?.chapterType ?? "Personal Life Chapter",
    meaning: mapped?.meaning ?? "This life goal may change your timing, preferred work environment, risk appetite, and the kind of career evidence you need to keep active.",
    focusTitle: "Risks / challenges",
    focus: mapped?.focus ?? ["Career momentum may become less linear", "Role choices may need more flexibility", "Portfolio evidence can become outdated if ignored"],
    skillsTitle: "Career coping strategy",
    skills: mapped?.skills ?? ["Choose work arrangements that support this chapter", "Keep one active project or learning signal visible", "Plan your return-to-work story before the transition"],
    evidenceTitle: "Evidence to maintain",
    evidence: mapped?.evidence ?? ["Updated Living Portfolio", "Recent project proof", "Reflection on transferable skills"],
    actionTitle: "Next 90-day action",
    action: mapped?.action ?? "Write a one-page chapter plan that connects this goal to your target role, workstyle, and portfolio evidence.",
    recommended: mapped?.recommended ?? "Flexible, supportive roles with clear expectations and room for transition planning.",
  };
}

function formatRm(value: number) {
  return `RM ${Math.round(value).toLocaleString("en-MY")}`;
}

function parseTargetYearInput(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(40, parsed);
}

function TimelineNodeItem({
  node,
  index,
  selected,
  active,
  onSelect,
}: {
  node: TimelineNode;
  index: number;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const isLife = node.type === "life";
  const Icon = isLife ? node.icon ?? Sparkles : BriefcaseBusiness;
  const activeColor = isLife ? theme.rose2 : theme.navy;
  const inactiveBorder = isLife ? theme.line : "#CBD3E5";

  return (
    <motion.button
      layout
      type="button"
      onClick={onSelect}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: selected ? 1.06 : 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      className="relative z-10 flex w-[190px] shrink-0 flex-col items-center text-center"
      style={{ transformOrigin: "center" }}
    >
      <span
        className={`grid h-14 w-14 place-items-center rounded-full border-4 shadow-lg transition ${
          selected ? "ring-8" : ""
        }`}
        style={{
          background: active
            ? isLife
              ? `linear-gradient(135deg, ${theme.rose1}, ${theme.rose2})`
              : `linear-gradient(135deg, ${theme.navy}, ${theme.deepNavy})`
            : "#fff",
          borderColor: active ? "#fff" : inactiveBorder,
          color: active ? "#fff" : activeColor,
          boxShadow: selected
            ? `0 18px 38px ${isLife ? "rgba(224,0,70,0.22)" : "rgba(8,20,51,0.22)"}`
            : active
              ? "0 12px 28px rgba(21, 34, 56, 0.12)"
              : "0 10px 22px rgba(21, 34, 56, 0.08)",
          "--tw-ring-color": isLife ? "rgba(240, 77, 122, 0.16)" : "rgba(8, 20, 51, 0.12)",
        } as React.CSSProperties}
      >
        <Icon className="h-6 w-6" />
      </span>
      <span
        className="mt-3 rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
        style={{
          backgroundColor: active ? (isLife ? theme.soft : "#F7F8FB") : "#fff",
          color: active ? (isLife ? theme.rose2 : theme.navy) : theme.muted,
        }}
      >
        {node.time}
      </span>
      <span className="mt-2 text-sm font-semibold leading-5 text-[#081433]">
        {node.title}
      </span>
      <span className="mt-1 min-h-[34px] text-xs leading-4 text-[#46536D]">
        {node.subtitle}
      </span>
      {isLife && (
        <span className="mt-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-[#E00046] shadow-sm ring-1 ring-[#F5CBD6]">
          {node.durationMonths ?? getDefaultDurationMonths(node.lifeGoalKey)} months
        </span>
      )}
      <span className="sr-only">Milestone {index + 1}</span>
    </motion.button>
  );
}

function AddLifeGoalModal({
  existingTitles,
  editNode,
  onClose,
  onAdd,
  onSave,
}: {
  existingTitles: Set<string>;
  editNode?: TimelineNode | null;
  onClose: () => void;
  onAdd: (goals: TimelineNode[]) => void;
  onSave?: (node: TimelineNode) => void;
}) {
  const isEdit = Boolean(editNode);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState(editNode?.title ?? "");
  const [targetYearInput, setTargetYearInput] = useState(editNode ? String(editNode.targetYear) : "1");
  const [durationInput, setDurationInput] = useState(String(editNode?.durationMonths ?? getDefaultDurationMonths(editNode?.lifeGoalKey)));
  const [chapterTypeKey, setChapterTypeKey] = useState(editNode?.lifeGoalKey ?? "custom");
  const [message, setMessage] = useState("");
  const previewYear = parseTargetYearInput(targetYearInput);
  const previewDuration = parseDurationInput(durationInput);

  function toggleGoal(key: string) {
    setSelectedKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function buildCustomKey(title: string) {
    return `custom-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "life-goal"}`;
  }

  function handleAdd() {
    if (isEdit && editNode && onSave) {
      const title = customGoal.trim();
      const finalTargetYear = parseTargetYearInput(targetYearInput);
      const finalDuration = parseDurationInput(durationInput);

      if (!title) {
        setMessage("Add a chapter title before saving.");
        return;
      }

      const duplicateTitle = existingTitles.has(title.toLowerCase()) && title.toLowerCase() !== editNode.title.toLowerCase();
      if (duplicateTitle) {
        setMessage("That chapter title is already on your timeline.");
        return;
      }

      const selectedOption = chapterTypeKey === "custom" ? undefined : getLifeOption(chapterTypeKey);
      const matchedOption = lifeGoalOptions.find((option) => option.title.toLowerCase() === title.toLowerCase());
      const option = selectedOption ?? matchedOption;

      onSave({
        ...editNode,
        title,
        time: yearLabel(finalTargetYear),
        subtitle: option?.chapterType ?? "Personal Life Chapter",
        targetYear: finalTargetYear,
        durationMonths: finalDuration,
        lifeGoalKey: option?.key ?? (editNode.lifeGoalKey?.startsWith("custom-") ? editNode.lifeGoalKey : buildCustomKey(title)),
        icon: option?.icon ?? Sparkles,
      });
      return;
    }

    const finalTargetYear = parseTargetYearInput(targetYearInput);
    const selectedOptions = selectedKeys
      .map((key) => lifeGoalOptions.find((option) => option.key === key))
      .filter((option): option is LifeGoalOption => Boolean(option));

    const custom = customGoal.trim();
    const customOption: LifeGoalOption | null = custom
      ? { key: buildCustomKey(custom), title: custom, icon: Sparkles, chapterType: "Personal Life Chapter" }
      : null;

    const nodes = [...selectedOptions, ...(customOption ? [customOption] : [])]
      .filter((option) => !existingTitles.has(option.title.toLowerCase()))
      .map((option) => createLifeNode(option, finalTargetYear));

    if (nodes.length === 0) {
      setMessage("That chapter is already on your timeline.");
      return;
    }

    onAdd(nodes);
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-end bg-[#081433]/35 p-4 backdrop-blur-sm sm:place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border bg-white shadow-[0_28px_80px_rgba(8,20,51,0.22)]"
        style={{ borderColor: theme.border }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-6 py-5" style={{ borderColor: theme.border }}>
          <div>
            <h2 className="text-xl font-semibold text-[#081433]">{isEdit ? "Edit life chapter" : "Add a life chapter"}</h2>
            <p className="mt-1 text-sm text-[#46536D]">
              {isEdit ? "Update the chapter details and duration." : "Choose life goals that may affect your career timeline."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-[#46536D] transition hover:bg-[#FFF2F6] hover:text-[#E00046]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {isEdit ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-[#081433]">Chapter title</span>
                <input
                  value={customGoal}
                  onChange={(event) => setCustomGoal(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none"
                  style={{ borderColor: theme.border }}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#081433]">Chapter type</span>
                <select
                  value={chapterTypeKey}
                  onChange={(event) => {
                    const nextKey = event.target.value;
                    setChapterTypeKey(nextKey);
                    const option = getLifeOption(nextKey);
                    if (option && !customGoal.trim()) setCustomGoal(option.title);
                    if (option) setDurationInput(String(editNode?.durationMonths ?? getDefaultDurationMonths(option.key)));
                  }}
                  className="mt-2 h-11 w-full rounded-xl border bg-white px-4 text-sm font-semibold text-[#46536D] outline-none"
                  style={{ borderColor: theme.border }}
                >
                  <option value="custom">Custom life goal</option>
                  {lifeGoalOptions.map((goal) => (
                    <option key={goal.key} value={goal.key}>{goal.title}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="flex items-center justify-between gap-3 text-sm font-semibold text-[#081433]">
                  Target year
                  <span className="rounded-full bg-[#FFF2F6] px-3 py-1 text-xs font-semibold text-[#E00046]">
                    {yearLabel(previewYear)}
                  </span>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={targetYearInput}
                  onChange={(event) => setTargetYearInput(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border bg-white px-4 text-sm font-semibold text-[#46536D] outline-none"
                  style={{ borderColor: theme.border }}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="flex items-center justify-between gap-3 text-sm font-semibold text-[#081433]">
                  Duration
                  <span className="rounded-full bg-[#FFF2F6] px-3 py-1 text-xs font-semibold text-[#E00046]">
                    {previewDuration} months
                  </span>
                </span>
                <span className="mt-2 flex h-11 items-center gap-2 rounded-xl border bg-white px-4" style={{ borderColor: theme.border }}>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={durationInput}
                    onChange={(event) => setDurationInput(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#46536D] outline-none"
                  />
                  <span className="text-xs font-semibold text-[#46536D]">months</span>
                </span>
                <p className="mt-2 text-xs leading-5 text-[#46536D]">
                  How long this life chapter is expected to last.
                </p>
              </label>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {lifeGoalOptions.map((goal) => {
                  const Icon = goal.icon;
                  const checked = selectedKeys.includes(goal.key);
                  return (
                    <label
                      key={goal.key}
                      className={`flex min-h-[72px] items-center gap-3 rounded-xl border p-3 transition ${
                        checked ? "bg-[#FFF7FA]" : "bg-white hover:bg-[#FFF9FB]"
                      }`}
                      style={{ borderColor: checked ? theme.rose1 : theme.border }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGoal(goal.key)}
                        className="career-checkbox h-4 w-4 accent-[#E00046]"
                      />
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF2F6] text-[#E00046]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-sm font-semibold leading-5 text-[#081433]">{goal.title}</span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_230px]">
                <label className="block">
                  <span className="text-sm font-semibold text-[#081433]">Add your own life goal</span>
                  <input
                    value={customGoal}
                    onChange={(event) => setCustomGoal(event.target.value)}
                    placeholder="Example: Move to Singapore in 3 years"
                    className="mt-2 h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none"
                    style={{ borderColor: theme.border }}
                  />
                </label>
                <label className="block">
                  <span className="flex items-center justify-between gap-3 text-sm font-semibold text-[#081433]">
                    Target year
                    <span className="rounded-full bg-[#FFF2F6] px-3 py-1 text-xs font-semibold text-[#E00046]">
                      {yearLabel(previewYear)}
                    </span>
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={targetYearInput}
                    onChange={(event) => setTargetYearInput(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border bg-white px-4 text-sm font-semibold text-[#46536D] outline-none"
                    style={{ borderColor: theme.border }}
                  />
                  <p className="mt-2 text-xs leading-5 text-[#46536D]">
                    Enter 0 for Now, or any year from 1 to 40.
                  </p>
                </label>
              </div>
            </>
          )}

          {message && <p className="mt-3 text-sm font-semibold text-[#E00046]">{message}</p>}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t px-6 py-5 sm:flex-row sm:justify-end" style={{ borderColor: theme.border }}>
          <button type="button" onClick={onClose} className="h-11 rounded-xl border px-5 text-sm font-semibold text-[#46536D] transition hover:bg-[#F8F9FB]" style={{ borderColor: theme.border }}>
            Cancel
          </button>
          <button type="button" onClick={handleAdd} className="career-pink-action flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white">
            {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isEdit ? "Save Changes" : "Add to Timeline"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ChapterPlanCard({ node }: { node: TimelineNode }) {
  const isLife = node.type === "life";

  return (
    <AnimatePresence mode="wait">
      <motion.article
        key={node.id}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden rounded-2xl border bg-white shadow-sm"
        style={{ borderColor: theme.border }}
      >
        {isLife ? <LifeChapterDashboard node={node} /> : <CareerMilestoneCard node={node} />}
      </motion.article>
    </AnimatePresence>
  );
}

function CareerMilestoneCard({ node }: { node: TimelineNode }) {
  const plan = getCareerPlan(node);

  return (
    <>
      <div className="bg-[linear-gradient(135deg,#081433,#152238)] p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white/80">
              Career milestone
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-normal">{plan.title}</h2>
            <p className="mt-2 text-sm text-white/70">{plan.eyebrow}</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-right">
            <p className="text-xs font-semibold text-white/60">Status</p>
            <p className="mt-1 text-sm font-semibold">Growth stage</p>
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="career-progress-fill h-full w-[68%] rounded-full bg-[#F04D7A]" />
        </div>
      </div>

      <div className="grid gap-5 p-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h3 className="text-sm font-semibold text-[#081433]">What this stage means</h3>
          <p className="mt-2 text-sm leading-7 text-[#46536D]">{plan.meaning}</p>

          <div className="mt-5 rounded-xl border bg-[#FFF7FA] p-4" style={{ borderColor: theme.line }}>
            <h3 className="text-sm font-semibold text-[#081433]">{plan.actionTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-[#46536D]">{plan.action}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <PlanList title={plan.focusTitle} items={plan.focus} accent="navy" />
          <PlanList title={plan.skillsTitle} items={plan.skills} accent="rose" />
          <PlanList title={plan.evidenceTitle} items={plan.evidence} accent="rose" />
        </div>
      </div>
    </>
  );
}

function LifeChapterDashboard({ node }: { node: TimelineNode }) {
  return <LifeChapterPlanningCard node={node} />;
}

type LifeFeatureKey = "impact" | "finance" | "return";
type NavigatorStepKey = "prepare" | "finance" | "return";

type FinancialPlan = {
  savings: number;
  monthlyCost: number;
  duration: number;
  oneTimeCost: number;
  emergencyMonths: number;
};

type ReturnReadinessPlan = {
  absenceMonths: number;
  plannedReturnMonth: number;
  targetRole: string;
  prepLeadMonths: number;
};

function LifeChapterPlanningCard({ node }: { node: TimelineNode }) {
  const plan = getLifePlan(node);
  const Icon = node.icon ?? Sparkles;
  const duration = node.durationMonths ?? getDefaultDurationMonths(node.lifeGoalKey);
  const features = getLifeChapterFeatures(node);
  const [activeFeature, setActiveFeature] = useState<LifeFeatureKey>("impact");
  const [isNavigatorVisible, setIsNavigatorVisible] = useState(false);
  const cardAreaRef = useRef<HTMLDivElement | null>(null);
  const careerImpactRef = useRef<HTMLElement | null>(null);
  const financialReadinessRef = useRef<HTMLElement | null>(null);
  const returnReadinessRef = useRef<HTMLElement | null>(null);
  const [financialPlan, setFinancialPlan] = useState<FinancialPlan>({
    savings: node.lifeGoalKey === "emergency-savings" ? 8000 : 18000,
    monthlyCost: 3000,
    duration,
    oneTimeCost: getDefaultOneTimeCost(node.lifeGoalKey),
    emergencyMonths: 6,
  });
  const [returnPlan, setReturnPlan] = useState<ReturnReadinessPlan>({
    absenceMonths: duration,
    plannedReturnMonth: duration,
    targetRole: "UX Designer",
    prepLeadMonths: duration > 18 ? 6 : duration > 6 ? 3 : 2,
  });
  const activeStep = getFeatureStep(activeFeature);

  useEffect(() => {
    const sections = [
      careerImpactRef.current,
      financialReadinessRef.current,
      returnReadinessRef.current,
    ].filter((section): section is HTMLElement => Boolean(section));

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const feature = visible?.target.getAttribute("data-feature") as LifeFeatureKey | null;
        if (feature) setActiveFeature(feature);
      },
      { rootMargin: "-25% 0px -45% 0px", threshold: [0.2, 0.45, 0.7] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [features]);

  useEffect(() => {
    const cardArea = cardAreaRef.current;
    if (!cardArea) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsNavigatorVisible(entry.isIntersecting),
      { rootMargin: "-18% 0px -18% 0px", threshold: [0.04, 0.18] },
    );

    observer.observe(cardArea);
    return () => observer.disconnect();
  }, []);

  const navigatorRefs: Record<NavigatorStepKey, React.RefObject<HTMLElement | null> | null> = {
    prepare: careerImpactRef,
    finance: features.includes("finance") ? financialReadinessRef : null,
    return: features.includes("return") ? returnReadinessRef : null,
  };

  return (
    <>
      <div className="bg-[radial-gradient(circle_at_88%_12%,rgba(240,77,122,0.32),transparent_18rem),linear-gradient(135deg,#081433,#152238)] p-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/12 text-[#FFD6E1] ring-1 ring-white/15">
              <Icon className="h-7 w-7" />
            </span>
            <div>
              <span className="rounded-full bg-[#FFF2F6]/14 px-3 py-1 text-xs font-semibold text-white/80">
                Life chapter blueprint
              </span>
              <h2 className="mt-4 text-2xl font-semibold tracking-normal">{plan.title}</h2>
              <p className="mt-2 text-sm text-white/70">{plan.eyebrow} / {node.time}</p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                {getChapterPurpose(node.lifeGoalKey)}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-right">
            <p className="text-xs font-semibold text-white/60">Duration</p>
            <p className="mt-1 text-sm font-semibold">{duration} months</p>
          </div>
        </div>
      </div>

      <div ref={cardAreaRef} className="bg-[linear-gradient(180deg,#FFF7FA_0%,#FFFFFF_44%,#F8F9FB_100%)] p-5 sm:p-6">
        <ChapterProgressRail
          activeStep={activeStep}
          visible={isNavigatorVisible}
          sectionRefs={navigatorRefs}
        />
        <div className="lg:hidden sticky top-3 z-20 mb-4">
          <ChapterProgressRail
            activeStep={activeStep}
            visible
            sectionRefs={navigatorRefs}
            mobile
          />
        </div>
        <div className="space-y-5">
            <FeatureShell id="career-impact-analysis" feature="impact" sectionRef={careerImpactRef}>
              <CareerImpactAnalysis node={node} />
            </FeatureShell>

            {features.includes("finance") && (
              <FeatureShell id="financial-readiness" feature="finance" sectionRef={financialReadinessRef}>
                <FinancialReadinessCalculator plan={financialPlan} onChange={setFinancialPlan} />
              </FeatureShell>
            )}

            {features.includes("return") && (
              <FeatureShell id="return-to-work-readiness" feature="return" sectionRef={returnReadinessRef}>
                <ReturnToWorkReadinessAssessment plan={returnPlan} onChange={setReturnPlan} />
              </FeatureShell>
            )}

            <p className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#46536D] shadow-sm ring-1 ring-[#E5E8F0]">
              This chapter helps you understand what may happen, whether you can afford it, and how difficult returning may be.
            </p>
        </div>
      </div>
    </>
  );
}

function getLifeChapterFeatures(node: TimelineNode): LifeFeatureKey[] {
  const key = node.lifeGoalKey;
  if (key === "investing") return ["impact"];
  if (key === "return-work") return ["impact", "return"];
  if (key === "family-planning" || key === "emergency-savings" || key === "retirement") return ["impact", "finance"];
  return ["impact", "finance", "return"];
}

function getChapterPurpose(key?: string) {
  if (key === "study-again") return "Plan the study chapter without losing career direction or financial control.";
  if (key === "side-business") return "Test the business path while protecting runway and return options.";
  if (key === "family-planning") return "Plan family milestones around stable income, time, and workload.";
  if (key === "emergency-savings") return "Build enough buffer before making higher-risk career moves.";
  if (key === "investing") return "Set a clear review date without turning investing into a separate finance app.";
  if (key === "return-work") return "Choose a practical return window after a break.";
  return "Plan the chapter without losing career direction or financial control.";
}

function getFeatureStep(feature: LifeFeatureKey): NavigatorStepKey {
  if (feature === "finance") return "finance";
  if (feature === "return") return "return";
  return "prepare";
}

function ChapterProgressRail({
  activeStep,
  visible,
  sectionRefs,
  mobile = false,
}: {
  activeStep: NavigatorStepKey;
  visible: boolean;
  sectionRefs: Record<NavigatorStepKey, React.RefObject<HTMLElement | null> | null>;
  mobile?: boolean;
}) {
  const steps: { key: NavigatorStepKey; label: string }[] = [
    { key: "prepare", label: "Prepare" },
    { key: "finance", label: "Finance" },
    { key: "return", label: "Return" },
  ];
  const activeIndex = Math.max(0, steps.findIndex((step) => step.key === activeStep));
  const fillHeight = activeIndex === 0 ? "14%" : activeIndex === 1 ? "50%" : "86%";
  const fillWidth = activeIndex === 0 ? "16%" : activeIndex === 1 ? "50%" : "86%";

  function scrollToStep(step: NavigatorStepKey) {
    const target = sectionRefs[step]?.current;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (mobile) {
    return (
      <nav className="rounded-full border bg-white/95 px-3 py-2 shadow-[0_14px_34px_rgba(8,20,51,0.14)] backdrop-blur" style={{ borderColor: theme.border }} aria-label="Chapter Navigator">
        <div className="relative grid grid-cols-3 gap-2">
          <div className="absolute left-[12%] right-[12%] top-3 h-0.5 rounded-full bg-[#E5E8F0]" />
          <motion.div
            className="absolute left-[12%] top-3 h-0.5 rounded-full bg-[#E00046]"
            animate={{ width: fillWidth }}
            transition={{ type: "spring", stiffness: 150, damping: 24 }}
          />
          {steps.map((step, index) => {
            const disabled = !sectionRefs[step.key]?.current;
            const active = step.key === activeStep;
            const completed = index < activeIndex && !disabled;
            return (
              <button
                key={step.key}
                type="button"
                disabled={disabled}
                aria-disabled={disabled}
                onClick={() => scrollToStep(step.key)}
                className="relative z-10 flex flex-col items-center gap-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35"
                style={{ color: active ? theme.rose2 : completed ? theme.navy : theme.muted }}
              >
                <motion.span
                  animate={{ scale: active ? 1.16 : 1 }}
                  className="h-6 w-6 rounded-full border-2"
                  style={{
                    borderColor: active || completed ? theme.rose2 : "#CBD3E5",
                    backgroundColor: active || completed ? theme.rose2 : "#fff",
                    boxShadow: active ? "0 0 0 5px rgba(240,77,122,0.14)" : "none",
                  }}
                />
                {step.label}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Chapter Navigator"
      className="pointer-events-auto fixed left-4 top-1/2 z-40 hidden w-[170px] -translate-y-1/2 rounded-[1.4rem] border bg-white/95 p-3 text-[#081433] shadow-[0_22px_60px_rgba(8,20,51,0.18)] backdrop-blur transition duration-300 lg:block"
      style={{
        borderColor: theme.border,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(-50%) translateX(0)" : "translateY(-50%) translateX(-12px)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#46536D]">Chapter Navigator</p>
      <div className="relative space-y-3">
        <div className="absolute bottom-3 left-[15px] top-3 w-0.5 rounded-full bg-[#E5E8F0]" />
        <motion.div
          className="absolute left-[15px] top-3 w-0.5 rounded-full bg-[#E00046]"
          animate={{ height: fillHeight }}
          transition={{ type: "spring", stiffness: 150, damping: 24 }}
        />
        {steps.map((step, index) => {
          const disabled = !sectionRefs[step.key]?.current;
          const completed = index < activeIndex;
          const active = step.key === activeStep;
          return (
            <button
              key={step.key}
              type="button"
              disabled={disabled}
              aria-disabled={disabled}
              onClick={() => scrollToStep(step.key)}
              className="relative flex w-full items-center gap-3 rounded-full px-2 py-1.5 text-left text-xs font-semibold transition hover:bg-[#FFF7FA] disabled:cursor-not-allowed disabled:opacity-35"
              style={{ color: active ? theme.rose2 : completed ? theme.navy : theme.muted }}
            >
              <motion.span
                animate={{ scale: active ? 1.22 : 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 20 }}
                className="z-10 h-4 w-4 shrink-0 rounded-full border-2"
                style={{
                  borderColor: active || completed ? theme.rose2 : "#CBD3E5",
                  backgroundColor: active || completed ? theme.rose2 : "#fff",
                  boxShadow: active ? "0 0 0 5px rgba(240,77,122,0.14)" : "none",
                }}
              />
              <span>{step.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function FeatureShell({
  id,
  feature,
  sectionRef,
  children,
}: {
  id: string;
  feature: LifeFeatureKey;
  sectionRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      ref={sectionRef}
      data-feature={feature}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.32 }}
    >
      {children}
    </motion.section>
  );
}

function CareerImpactAnalysis({ node }: { node: TimelineNode }) {
  const profile = getCareerImpactProfile(node);

  return (
    <section className="overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_45px_rgba(21,34,56,0.09)] ring-1 ring-[#E5E8F0]">
      <div className="bg-[radial-gradient(circle_at_92%_0%,rgba(240,77,122,0.14),transparent_16rem),linear-gradient(135deg,#FFFFFF,#FFF7FA)] p-5">
        <span className="rounded-full bg-[#081433] px-3 py-1 text-xs font-semibold text-white">Career Impact Analysis</span>
        <h3 className="mt-4 text-xl font-semibold text-[#081433]">What this chapter may change</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#46536D]">
          Compare the likely career trade-offs with the upside this chapter may create.
        </p>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-2">
        <ImpactColumn title="Potential impacts" tone="risk" items={profile.impacts} />
        <ImpactColumn title="Potential benefits" tone="benefit" items={profile.benefits} />
      </div>
    </section>
  );
}

function ImpactColumn({ title, tone, items }: { title: string; tone: "risk" | "benefit"; items: string[] }) {
  const color = tone === "risk" ? theme.rose2 : "#1E9E72";
  const bg = tone === "risk" ? "#FFF2F6" : "#ECFDF5";

  return (
    <div className="rounded-[1.5rem] bg-[#F8F9FB] p-4">
      <h4 className="text-sm font-semibold text-[#081433]">{title}</h4>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div
            key={item}
            className="flex min-h-11 items-center gap-3 rounded-full px-3 py-2 text-xs font-semibold leading-5 shadow-sm"
            style={{ backgroundColor: bg, color }}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/80">
              {tone === "risk" ? "!" : "+"}
            </span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getCareerImpactProfile(node: TimelineNode) {
  const common = {
    impacts: ["Promotion timing may shift", "Network activity can slow", "Portfolio evidence may age"],
    benefits: ["Clearer priorities", "Stronger life fit", "Transferable perspective"],
    riskScore: 50,
    benefitScore: 58,
  };
  const profiles: Record<string, typeof common> = {
    "study-again": {
      impacts: ["Delayed promotion timeline", "Income may pause", "Skills need applied practice", "Network activity may reduce"],
      benefits: ["New credentials", "Higher specialisation", "Stronger long-term mobility", "Fresh portfolio evidence"],
      riskScore: 55,
      benefitScore: 76,
    },
    "side-business": {
      impacts: ["Split attention", "Energy pressure", "Role performance may fluctuate", "Income can be less predictable"],
      benefits: ["Commercial judgment", "Customer insight", "Ownership signal", "Product and sales evidence"],
      riskScore: 62,
      benefitScore: 74,
    },
    "health-break": {
      impacts: ["Career pace slows", "Re-entry story matters", "Professional visibility may dip"],
      benefits: ["Burnout recovery", "Sustainable work rhythm", "Better long-term clarity"],
      riskScore: 58,
      benefitScore: 70,
    },
    relocate: {
      impacts: ["Market reset", "Local network gap", "Visa or timing uncertainty"],
      benefits: ["International exposure", "New market options", "Broader career identity"],
      riskScore: 64,
      benefitScore: 72,
    },
    "emergency-savings": {
      impacts: ["Riskier moves may wait", "Salary certainty becomes more important"],
      benefits: ["Higher career resilience", "Better negotiating confidence", "More stable decisions"],
      riskScore: 30,
      benefitScore: 66,
    },
    investing: {
      impacts: ["Short-term attention split", "Financial choices may affect risk appetite"],
      benefits: ["Long-term confidence", "Better planning discipline", "More informed career trade-offs"],
      riskScore: 24,
      benefitScore: 55,
    },
    "career-break": {
      impacts: ["Reduced lifetime earnings", "Temporary skill depreciation", "Re-entry challenges", "Network activity drops"],
      benefits: ["Improved work-life balance", "Personal development", "Reduced burnout", "Long-term priority clarity"],
      riskScore: 68,
      benefitScore: 70,
    },
  };

  return node.lifeGoalKey ? profiles[node.lifeGoalKey] ?? common : common;
}

function getDefaultOneTimeCost(key?: string) {
  if (key === "study-again") return 18000;
  if (key === "relocate") return 12000;
  if (key === "family-planning") return 15000;
  if (key === "side-business") return 8000;
  return 5000;
}

function calculateFinancialReadiness(plan: FinancialPlan) {
  const livingCost = plan.monthlyCost * plan.duration;
  const emergencyFund = plan.monthlyCost * plan.emergencyMonths;
  const recommendedSavings = livingCost + plan.oneTimeCost + emergencyFund;
  const gap = plan.savings - recommendedSavings;
  const ratio = plan.savings / Math.max(1, recommendedSavings);
  const status = ratio >= 1 ? "Ready" : ratio >= 0.75 ? "Almost ready" : "Not ready";

  return {
    livingCost,
    emergencyFund,
    recommendedSavings,
    gap,
    status,
    progress: Math.min(100, ratio * 100),
  };
}

function FinancialReadinessCalculator({
  plan,
  onChange,
}: {
  plan: FinancialPlan;
  onChange: (next: FinancialPlan) => void;
}) {
  const result = calculateFinancialReadiness(plan);

  function update<K extends keyof FinancialPlan>(key: K, value: FinancialPlan[K]) {
    onChange({ ...plan, [key]: value });
  }

  return (
    <section className="rounded-[2rem] bg-white p-5 shadow-[0_20px_45px_rgba(21,34,56,0.09)] ring-1 ring-[#E5E8F0]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[#FFF2F6] text-[#E00046]">
            <Calculator className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E00046]">Financial Readiness</p>
            <h3 className="text-xl font-semibold text-[#081433]">Can this chapter be funded?</h3>
          </div>
        </div>
        <StatusPill status={result.status} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <NumberField label="Current savings" prefix="RM" value={plan.savings} min={0} max={500000} onChange={(value) => update("savings", value)} />
        <NumberField label="Monthly living cost" prefix="RM" value={plan.monthlyCost} min={1} max={50000} onChange={(value) => update("monthlyCost", value)} />
        <NumberField label="Chapter duration" suffix="months" value={plan.duration} min={1} max={60} onChange={(value) => update("duration", value)} />
        <NumberField label="One-time chapter cost" prefix="RM" value={plan.oneTimeCost} min={0} max={500000} onChange={(value) => update("oneTimeCost", value)} />
        <NumberField label="Emergency fund" suffix="months" value={plan.emergencyMonths} min={1} max={24} onChange={(value) => update("emergencyMonths", value)} />
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#F7D8E1]">
        <motion.div
          className="h-full rounded-full bg-[linear-gradient(90deg,#E00046,#F04D7A)]"
          animate={{ width: `${result.progress}%` }}
          transition={{ type: "spring", stiffness: 130, damping: 22 }}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBubble label="Estimated living cost" value={formatRm(result.livingCost)} />
        <MetricBubble label="Emergency fund" value={formatRm(result.emergencyFund)} />
        <MetricBubble label="Recommended savings" value={formatRm(result.recommendedSavings)} />
        <MetricBubble label={result.gap < 0 ? "Current gap" : "Current surplus"} value={formatRm(Math.abs(result.gap))} />
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const ready = status === "Ready";
  const almost = status === "Almost ready";
  return (
    <span
      className="rounded-full px-4 py-2 text-sm font-semibold"
      style={{
        backgroundColor: ready ? "#ECFDF5" : almost ? "#FFF7ED" : theme.soft,
        color: ready ? "#1E9E72" : almost ? "#C56A14" : theme.rose2,
      }}
    >
      {status}
    </span>
  );
}

function MetricBubble({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full bg-[#F8F9FB] px-5 py-4 shadow-inner">
      <p className="text-xs font-semibold text-[#46536D]">{label}</p>
      <p className="mt-1 text-base font-semibold text-[#081433]">{value}</p>
    </div>
  );
}

function ReturnToWorkReadinessAssessment({
  plan,
  onChange,
}: {
  plan: ReturnReadinessPlan;
  onChange: (next: ReturnReadinessPlan) => void;
}) {
  const result = buildReEntryPlan(plan);

  function update<K extends keyof ReturnReadinessPlan>(key: K, value: ReturnReadinessPlan[K]) {
    onChange({ ...plan, [key]: value });
  }

  return (
    <section className="rounded-[2rem] bg-[#081433] p-5 text-white shadow-[0_24px_60px_rgba(8,20,51,0.18)]">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/12 text-[#FFD6E1]">
          <RefreshCcw className="h-5 w-5" />
        </span>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Return-to-Work Readiness</p>
            <h3 className="text-xl font-semibold">Prepare the re-entry path</h3>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {result.requirements.map((item) => (
          <div key={item.area} className="rounded-[1.35rem] bg-white p-4 text-[#081433]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{item.area}</p>
                <p className="mt-1 text-xs font-semibold text-[#46536D]">{item.status}</p>
              </div>
              <span className="rounded-full bg-[#FFF2F6] px-2.5 py-1 text-xs font-semibold text-[#E00046]">{item.progress}%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F7D8E1]">
              <motion.div
                className="h-full rounded-full bg-[#E00046]"
                initial={{ width: 0 }}
                whileInView={{ width: `${item.progress}%` }}
                viewport={{ once: true }}
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-[#46536D]">{item.action}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.5rem] bg-white/8 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Action planner</p>
          <div className="mt-3 grid gap-3">
            <DarkNumberField label="Planned return month" value={plan.plannedReturnMonth} min={1} max={120} suffix="month" onChange={(value) => update("plannedReturnMonth", value)} />
            <DarkTextField label="Target role" value={plan.targetRole} onChange={(value) => update("targetRole", value)} />
            <DarkNumberField label="Start preparing" value={plan.prepLeadMonths} min={1} max={12} suffix="months before" onChange={(value) => update("prepLeadMonths", value)} />
          </div>
          <p className="mt-3 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold leading-5 text-white/70">
            {result.riskNote}
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-white p-4 text-[#081433]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#46536D]">Preparation timeline</p>
          <div className="mt-3 grid gap-2">
            {result.timeline.map((item) => (
              <div key={`${item.month}-${item.action}`} className="flex gap-3 rounded-2xl bg-[#FFF7FA] px-3 py-2">
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#E00046]">Month {item.month}</span>
                <p className="text-xs font-semibold leading-5 text-[#081433]">{item.action}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DarkNumberField({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix?: string; onChange: (value: number) => void }) {
  return (
    <label className="rounded-[1.2rem] bg-white/8 p-3">
      <span className="text-xs font-semibold text-white/55">{label}</span>
      <span className="mt-2 flex h-10 items-center gap-2 rounded-full bg-white/10 px-4">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            onChange(Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min);
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none"
        />
        {suffix && <span className="text-xs font-semibold text-white/45">{suffix}</span>}
      </span>
    </label>
  );
}

function DarkTextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="rounded-[1.2rem] bg-white/8 p-3">
      <span className="text-xs font-semibold text-white/55">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-full border-0 bg-white/10 px-4 text-sm font-semibold text-white outline-none"
      />
    </label>
  );
}

function buildReEntryPlan(plan: ReturnReadinessPlan) {
  const longBreak = plan.absenceMonths > 18;
  const mediumBreak = plan.absenceMonths > 6;
  const startMonth = Math.max(1, plan.plannedReturnMonth - plan.prepLeadMonths);
  const skillProgress = longBreak ? 35 : mediumBreak ? 55 : 72;
  const visibilityProgress = longBreak ? 30 : mediumBreak ? 48 : 64;
  const interviewProgress = mediumBreak ? 50 : 62;
  const timingProgress = plan.prepLeadMonths >= (longBreak ? 6 : mediumBreak ? 3 : 2) ? 78 : 46;

  const requirements = [
    {
      area: "Skill Currency",
      status: longBreak ? "Needs refresh" : mediumBreak ? "Partial" : "Mostly current",
      action: `Complete one short ${plan.targetRole || "role"} refresher course before Month ${Math.max(1, plan.plannedReturnMonth - 1)}.`,
      progress: skillProgress,
    },
    {
      area: "Market Visibility",
      status: longBreak ? "Weak" : "Quiet",
      action: "Attend one industry event or reconnect with 3 professional contacts.",
      progress: visibilityProgress,
    },
    {
      area: "Interview Readiness",
      status: mediumBreak ? "Partial" : "Needs story",
      action: "Prepare one clear explanation for the career break and current work readiness.",
      progress: interviewProgress,
    },
    {
      area: "Availability & Timing",
      status: timingProgress >= 70 ? "Good" : "Tight",
      action: `Start applications ${plan.prepLeadMonths} months before the planned return window.`,
      progress: timingProgress,
    },
  ];

  const timeline = [
    { month: startMonth, action: `Refresh ${plan.targetRole || "target role"} skills and choose one proof-of-work project.` },
    { month: Math.min(plan.plannedReturnMonth, startMonth + 1), action: "Update resume, portfolio, and career break explanation." },
    { month: Math.min(plan.plannedReturnMonth, startMonth + 2), action: "Start applications, networking, and interview practice." },
    { month: plan.plannedReturnMonth, action: "Return target window." },
  ].filter((item, index, list) => index === 0 || item.month >= list[index - 1].month);

  const riskNote = plan.absenceMonths <= 6
    ? "Short break. Main focus is explanation and timing."
    : plan.absenceMonths <= 18
      ? "Medium break. Refresh skills and start preparing early."
      : "Long break. Build a stronger return plan and prepare earlier.";

  return { requirements, timeline, riskNote };
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="rounded-xl border bg-white p-3" style={{ borderColor: theme.border }}>
      <span className="text-xs font-semibold text-[#46536D]">{label}</span>
      <span className="mt-2 flex h-10 items-center gap-2 rounded-xl border bg-white px-3" style={{ borderColor: theme.border }}>
        {prefix && <span className="text-xs font-semibold text-[#46536D]">{prefix}</span>}
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            onChange(Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min);
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#081433] outline-none"
        />
        {suffix && <span className="text-xs font-semibold text-[#46536D]">{suffix}</span>}
      </span>
    </label>
  );
}

function PlanList({ title, items, accent = "rose" }: { title: string; items: string[]; accent?: "rose" | "navy" }) {
  const dot = {
    rose: theme.rose2,
    navy: theme.navy,
  }[accent];

  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: theme.border }}>
      <h3 className="text-sm font-semibold text-[#081433]">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-[#46536D]">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LifeChapterDesigner() {
  const [startingPoint, setStartingPoint] = useState<StartingPoint>("Final Year Student");
  const [lifeNodes, setLifeNodes] = useState<TimelineNode[]>([]);
  const [selectedId, setSelectedId] = useState("student");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const selectedNodeRef = useRef<HTMLDivElement | null>(null);

  const timelineNodes = useMemo(
    () => sortTimelineNodes([...careerTemplates[startingPoint].nodes, ...lifeNodes]),
    [startingPoint, lifeNodes],
  );
  const selectedIndex = Math.max(0, timelineNodes.findIndex((node) => node.id === selectedId));
  const selectedNode = timelineNodes[selectedIndex] ?? timelineNodes[0];
  const existingTitles = useMemo(() => new Set(timelineNodes.map((node) => node.title.toLowerCase())), [timelineNodes]);
  const editingNode = editingNodeId ? lifeNodes.find((node) => node.id === editingNodeId) ?? null : null;
  const deleteCandidate = deleteCandidateId ? timelineNodes.find((node) => node.id === deleteCandidateId) ?? null : null;
  const progressPercent = timelineNodes.length <= 1 ? 0 : (selectedIndex / (timelineNodes.length - 1)) * 100;
  const timelineWidth = timelineNodes.length <= 5 ? "100%" : `${timelineNodes.length * 216}px`;

  useEffect(() => {
    selectedNodeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedId, timelineNodes.length]);

  function changeStartingPoint(value: StartingPoint) {
    setStartingPoint(value);
    setLifeNodes([]);
    setSelectedId(careerTemplates[value].nodes[0].id);
  }

  function shiftSelection(direction: -1 | 1) {
    const nextIndex = Math.min(timelineNodes.length - 1, Math.max(0, selectedIndex + direction));
    setSelectedId(timelineNodes[nextIndex].id);
  }

  function addLifeGoals(nodes: TimelineNode[]) {
    const merged = sortTimelineNodes([...lifeNodes, ...nodes]);
    setLifeNodes(merged);
    setSelectedId(nodes[nodes.length - 1].id);
    setIsModalOpen(false);
  }

  function openAddModal() {
    setEditingNodeId(null);
    setIsModalOpen(true);
  }

  function openEditModal(node: TimelineNode) {
    if (node.type !== "life") return;
    setEditingNodeId(node.id);
    setIsModalOpen(true);
  }

  function saveLifeGoal(updatedNode: TimelineNode) {
    setLifeNodes((current) => sortTimelineNodes(current.map((node) => (node.id === updatedNode.id ? updatedNode : node))));
    setSelectedId(updatedNode.id);
    setEditingNodeId(null);
    setIsModalOpen(false);
  }

  function deleteLifeGoal(nodeId: string) {
    const nodeToRemove = timelineNodes.find((node) => node.id === nodeId);
    if (!nodeToRemove || nodeToRemove.type !== "life") return;

    const nodeIndex = timelineNodes.findIndex((node) => node.id === nodeId);
    const remainingTimeline = timelineNodes.filter((node) => node.id !== nodeId);
    const previousNode = remainingTimeline[Math.max(0, nodeIndex - 1)] ?? remainingTimeline[0];

    setLifeNodes((current) => current.filter((node) => node.id !== nodeId));
    setSelectedId(previousNode?.id ?? careerTemplates[startingPoint].nodes[0].id);
    setDeleteCandidateId(null);
  }

  return (
    <main className="min-h-screen bg-[#fbfbfc] text-[#152238]" style={{ fontFamily: "var(--font-geist-sans), Arial, Helvetica, sans-serif" }}>
      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
        <div className="career-fade-up overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: theme.border }}>
          <div className="relative overflow-hidden bg-[#081433] px-7 py-8 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(240,77,122,0.30),transparent_22rem),radial-gradient(circle_at_10%_90%,rgba(125,182,255,0.18),transparent_18rem),linear-gradient(135deg,#081433,#152238)]" />
            <div className="relative z-10 max-w-4xl">
              <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white/78 backdrop-blur-sm">
                Career-life planning module
              </span>
              <h1 className="mt-5 text-4xl font-semibold tracking-normal text-white md:text-5xl">
                Life Chapter Designer
              </h1>
              <p className="mt-4 text-lg font-medium text-white/82">
                Design your career around real life milestones, not just job titles.
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70 md:text-base">
                Map your career growth path together with savings, study plans, family goals, career breaks, entrepreneurship, and comeback strategies.
              </p>
            </div>
          </div>
        </div>

        <section className="career-fade-up mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: theme.border, animationDelay: "120ms" }}>
          <div className="flex flex-col gap-4 border-b px-6 py-5 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: theme.border }}>
            <label className="w-full max-w-xs">
              <span className="text-sm font-semibold text-[#081433]">Starting point</span>
              <span className="relative mt-2 block">
                <select
                  value={startingPoint}
                  onChange={(event) => changeStartingPoint(event.target.value as StartingPoint)}
                  className="h-11 w-full appearance-none rounded-xl border bg-white px-4 pr-10 text-sm font-semibold text-[#46536D] outline-none"
                  style={{ borderColor: theme.border }}
                >
                  {startingOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#46536D]" />
              </span>
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="rounded-full bg-[#FFF2F6] px-3 py-1 text-xs font-semibold text-[#E00046]">
                Selected progress: {selectedIndex + 1}/{timelineNodes.length}
              </span>
              <button
                type="button"
                aria-label="Edit selected life chapter"
                disabled={selectedNode.type !== "life"}
                onClick={() => openEditModal(selectedNode)}
                className="grid h-11 w-11 place-items-center rounded-xl border bg-white text-[#081433] shadow-sm transition hover:bg-[#FFF2F6] disabled:cursor-not-allowed disabled:text-[#A8B0C2] disabled:opacity-45"
                style={{ borderColor: theme.border }}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Delete selected life chapter"
                disabled={selectedNode.type !== "life"}
                onClick={() => setDeleteCandidateId(selectedNode.id)}
                className="grid h-11 w-11 place-items-center rounded-xl border bg-white text-[#E00046] shadow-sm transition hover:bg-[#FFF2F6] disabled:cursor-not-allowed disabled:text-[#A8B0C2] disabled:opacity-45"
                style={{ borderColor: theme.border }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="career-pink-action flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Add Life Goal
              </button>
            </div>
          </div>

          <div className="bg-[linear-gradient(135deg,#FFF7FA_0%,#FFFFFF_46%,#FFF2F6_100%)] px-4 py-7 sm:px-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <button type="button" onClick={() => shiftSelection(-1)} disabled={selectedIndex === 0} className="grid h-10 w-10 place-items-center rounded-xl border bg-white text-[#081433] shadow-sm transition hover:bg-[#FFF2F6] disabled:opacity-35" style={{ borderColor: theme.border }}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="text-center text-sm font-semibold text-[#46536D]">
                {selectedNode.title} / {selectedNode.time}
              </p>
              <button type="button" onClick={() => shiftSelection(1)} disabled={selectedIndex === timelineNodes.length - 1} className="grid h-10 w-10 place-items-center rounded-xl border bg-white text-[#081433] shadow-sm transition hover:bg-[#FFF2F6] disabled:opacity-35" style={{ borderColor: theme.border }}>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-x-auto px-1 pb-3">
              <div
                className="relative flex min-w-[960px] items-start justify-between px-6 py-5"
                style={{ width: timelineWidth }}
              >
                <div className="absolute left-[calc(1.5rem+95px)] right-[calc(1.5rem+95px)] top-[48px] h-1 rounded-full bg-[#E5E8F0]" />
                <motion.div
                  className="absolute left-[calc(1.5rem+95px)] top-[48px] h-1 rounded-full bg-[linear-gradient(90deg,#081433,#F04D7A)]"
                  animate={{ width: `calc((100% - 3rem - 190px) * ${progressPercent / 100})` }}
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                />
                <AnimatePresence initial={false}>
                  {timelineNodes.map((node, index) => (
                    <div key={node.id} ref={node.id === selectedNode.id ? selectedNodeRef : null}>
                      <TimelineNodeItem
                        node={node}
                        index={index}
                        selected={node.id === selectedNode.id}
                        active={index <= selectedIndex}
                        onSelect={() => setSelectedId(node.id)}
                      />
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <AnimatePresence>
            {deleteCandidate?.type === "life" && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-3 flex flex-col gap-3 rounded-2xl border bg-[#081433] px-4 py-4 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm font-semibold">Remove this life chapter from your timeline?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDeleteCandidateId(null)} className="h-10 rounded-full border border-white/20 px-4 text-sm font-semibold text-white/80 transition hover:bg-white/10">
                    Cancel
                  </button>
                  <button type="button" onClick={() => deleteLifeGoal(deleteCandidate.id)} className="h-10 rounded-full bg-white px-4 text-sm font-semibold text-[#E00046] transition hover:bg-[#FFF2F6]">
                    Remove
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <ChapterPlanCard node={selectedNode} />
        </div>
      </section>

      <AnimatePresence>
        {isModalOpen && (
          <AddLifeGoalModal
            existingTitles={existingTitles}
            editNode={editingNode}
            onClose={() => {
              setIsModalOpen(false);
              setEditingNodeId(null);
            }}
            onAdd={addLifeGoals}
            onSave={saveLifeGoal}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
