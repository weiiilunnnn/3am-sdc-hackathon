import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  ChevronDown,
  CircleUserRound,
  Flag,
  FolderKanban,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

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

const trajectories = [
  {
    rank: "#1",
    title: "BI Analyst Track",
    description: "Turn data into impact and drive business decisions.",
    match: 92,
    profiles: 742,
    difficulty: "Easy",
    difficultyClass: "bg-emerald-100 text-emerald-700",
    bars: "bg-emerald-500",
    steps: [
      ["Current Profile", "Data Enthusiast"],
      ["Entry Role", "Junior Data Analyst"],
      ["Next Role", "BI Analyst"],
      ["Growth Direction", "Senior Data Analyst / BI Specialist"],
    ],
  },
  {
    rank: "#2",
    title: "Business Analysis Track",
    description: "Bridge business needs and technology solutions.",
    match: 86,
    profiles: 618,
    difficulty: "Moderate",
    difficultyClass: "bg-orange-100 text-orange-700",
    bars: "bg-orange-500",
    steps: [
      ["Current Profile", "Analytical Thinker"],
      ["Entry Role", "Business Analyst"],
      ["Next Role", "Senior Business Analyst"],
      ["Growth Direction", "Product Owner / Business Consultant"],
    ],
  },
  {
    rank: "#3",
    title: "Product Operations Track",
    description: "Optimize operations and scale product impact.",
    match: 81,
    profiles: 529,
    difficulty: "Challenging",
    difficultyClass: "bg-rose-100 text-rose-700",
    bars: "bg-rose-600",
    steps: [
      ["Current Profile", "Detail-Oriented"],
      ["Entry Role", "Product Operations Associate"],
      ["Next Role", "Operations Manager"],
      ["Growth Direction", "Head of Product Operations"],
    ],
  },
];

const matchSignals = [
  {
    icon: Target,
    title: "Skills\nOverlap",
    text: "Matched based on 24 core skills and competencies.",
  },
  {
    icon: GraduationCap,
    title: "Education Similarity",
    text: "Compared against candidates with similar academic backgrounds.",
  },
  {
    icon: FolderKanban,
    title: "Projects & Portfolio",
    text: "Analyzed 6 projects and practical experience similarities.",
  },
  {
    icon: BarChart3,
    title: "Experience Patterns",
    text: "Looked at career transitions and role progression patterns.",
  },
];

function SectionCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: theme.border }}
    >
      <div className="flex min-h-[76px] flex-col gap-4 rounded-t-2xl border-b border-[#F1F3F7] bg-white px-7 py-4 shadow-[0_8px_14px_rgba(21,34,56,0.035)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.soft }}
          >
            <Icon className="h-5 w-5" style={{ color: theme.rose2 }} />
          </div>

          <h2 className="text-lg font-semibold leading-none text-[#152238]">
            {title}
          </h2>
        </div>

        {action}
      </div>

      <div className="px-7 py-5">{children}</div>
    </section>
  );
}

function ProgressRing({ value }: { value: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative grid h-28 w-28 shrink-0 place-items-center">
      <svg className="h-28 w-28 -rotate-90" viewBox="0 0 104 104" aria-hidden>
        <circle
          cx="52"
          cy="52"
          r={radius}
          className="fill-none stroke-gray-100"
          strokeWidth="8"
        />
        <circle
          cx="52"
          cy="52"
          r={radius}
          className="career-ring-progress fill-none stroke-[#E00046]"
          strokeLinecap="round"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-semibold tracking-normal text-[#081433]">
          {value}%
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-[#46536D]">Match</p>
      </div>
    </div>
  );
}

function TrajectoryCard({
  trajectory,
}: {
  trajectory: (typeof trajectories)[number];
}) {
  return (
    <article className="career-fade-up rounded-2xl border bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(21,34,56,0.10)]" style={{ borderColor: theme.border }}>
      <div className="grid gap-5 lg:grid-cols-[104px_minmax(0,1fr)_138px] lg:gap-x-8">
        <div className="flex items-center gap-4 lg:block">
          <ProgressRing value={trajectory.match} />
          <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-emerald-600">
            <BadgeCheck className="h-4 w-4" />
            High Confidence
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start gap-3">
            <span className="rounded-md px-2.5 py-1 text-sm font-semibold" style={{ backgroundColor: theme.soft, color: theme.rose2 }}>
              {trajectory.rank}
            </span>
            <div>
              <h3 className="text-lg font-semibold text-[#081433]">
                {trajectory.title}
              </h3>
              <p className="mt-1 text-sm text-[#46536D]">
                {trajectory.description}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-6 md:grid-cols-4">
            {trajectory.steps.map(([label, value], index) => (
              <div
                className="relative"
                key={`${trajectory.title}-${label}`}
              >
                <div className="h-full min-h-[84px] rounded-xl border bg-white px-4 py-3 transition duration-300 hover:border-[#F04D7A] hover:bg-[#FFF7FA]" style={{ borderColor: theme.border }}>
                  <div className="flex h-full items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: theme.soft, color: theme.rose2 }}>
                      {index === 3 ? (
                        <BriefcaseBusiness className="h-4 w-4" />
                      ) : (
                        <CircleUserRound className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#081433]">
                        {label}
                      </p>
                      <p className="mt-1 text-xs leading-4 text-[#46536D]">
                        {value}
                      </p>
                    </div>
                  </div>
                </div>
                {index < trajectory.steps.length - 1 && (
                  <div className="absolute right-[-21px] top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border bg-white text-[#46536D] shadow-sm md:flex" style={{ borderColor: theme.border }}>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <Link
            className="mx-auto mt-4 flex w-fit items-center gap-2 text-sm font-semibold transition hover:translate-x-1"
            style={{ color: theme.rose2 }}
            href="/?view=deep-dive"
          >
            View Path Details
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex h-full flex-row justify-between gap-4 lg:flex-col lg:items-end lg:justify-between lg:pl-4">
          <div className="flex items-start gap-2 text-sm text-[#46536D]">
            <UsersRound className="mt-0.5 h-5 w-5 text-[#081433]" />
            <span>
              Based on {trajectory.profiles}
              <br />
              similar profiles
            </span>
          </div>
          <div className="mt-8 text-left lg:mt-14 lg:text-right">
            <div className="flex items-center gap-2 lg:justify-end">
              <p className="text-xs text-[#46536D]">Difficulty</p>
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${trajectory.difficultyClass}`}
              >
                {trajectory.difficulty}
              </span>
            </div>
            <div className="mt-3 flex gap-1 lg:justify-end">
              {Array.from({ length: 6 }).map((_, index) => (
                <span
                  className={`h-1.5 w-5 rounded-full ${
                    index < 4 ? trajectory.bars : "bg-gray-200"
                  }`}
                  key={index}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function CareerLandscape() {
  return (
    <main
      className="min-h-screen bg-[#fbfbfc] text-[#152238]"
      style={{
        fontFamily: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
      }}
    >

      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
        <div className="career-fade-up relative overflow-hidden rounded-2xl text-white shadow-[0_18px_40px_rgba(21,34,56,0.18)]" style={{ animationDelay: "160ms" }}>
          <img
            src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1800&q=80"
            alt="Career planning workspace with analytics"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#081433]/95 via-[#081433]/82 to-[#081433]/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#081433]/70 via-transparent to-transparent" />

          <div className="relative z-10 p-8">
            <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
              <div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
                    Profile intelligence
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
                    Career growth
                  </span>
                </div>

                <h1 className="text-4xl font-semibold tracking-normal text-white md:text-5xl">
                  Career Landscape
                </h1>

                <p className="mt-5 max-w-3xl text-sm leading-7 text-white/75 md:text-base">
                  AI-matched career blueprints based on similar candidate
                  histories, related skills, education, and project experience.
                </p>

                <Link
                  href="/?view=career-path-simulator"
                  className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#E00046] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(224,0,70,0.24)] transition hover:bg-[#D81B3F]"
                >
                  Open Career Path Simulator
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/15 bg-white/[0.12] px-4 py-4 shadow-sm backdrop-blur-md">
                    <div className="mb-2 flex items-center gap-2 text-white/65">
                      <UsersRound className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-[0.18em]">
                        Profiles
                      </span>
                    </div>
                    <p className="text-base font-semibold text-white">9,842</p>
                    <p className="mt-1 text-xs font-medium text-white/65">
                      Similar profiles analyzed
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-white/[0.12] px-4 py-4 shadow-sm backdrop-blur-md">
                    <div className="mb-2 flex items-center gap-2 text-white/65">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-[0.18em]">
                        Confidence
                      </span>
                    </div>
                    <p className="text-base font-semibold text-white">87% High</p>
                    <p className="mt-1 text-xs font-medium text-white/65">
                      Trajectory confidence
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/15 bg-white/[0.12] px-4 py-4 shadow-sm backdrop-blur-md">
                    <div className="mb-2 flex items-center gap-2 text-white/65">
                      <RefreshCw className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-[0.18em]">
                        Portfolio
                      </span>
                    </div>
                    <p className="text-base font-semibold text-white">2 days ago</p>
                    <p className="mt-1 text-xs font-medium text-white/65">
                      Auto-sync active
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/[0.12] p-5 shadow-sm backdrop-blur-md">
                <div className="mb-4 flex items-center gap-4">
                  <div className="glow-pulse grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/12 text-white ring-8 ring-white/10">
                    <BadgeCheck className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Trajectory analysis complete
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-white/70">
                      Ranked by match quality and career progression confidence.
                    </p>
                  </div>
                </div>

                <div className="relative h-32">
                  <svg
                    className="h-full w-full"
                    viewBox="0 0 520 112"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <path
                      className="career-line-draw"
                      d="M4 80 C42 62 64 70 92 60 S148 64 178 45 S232 50 260 35 S320 72 360 48 S422 62 454 33 S494 30 516 18"
                      fill="none"
                      stroke="#ffffff"
                      strokeDasharray="4 5"
                      strokeWidth="2"
                    />
                    <path
                      className="career-line-draw"
                      d="M4 66 C42 42 72 48 104 35 S154 80 190 66 S230 24 268 56 S314 20 354 42 S400 74 436 58 S486 74 516 48"
                      fill="none"
                      stroke="#F04D7A"
                      strokeDasharray="3 5"
                      strokeWidth="2"
                    />
                    {[90, 178, 258, 356, 454].map((x, index) => (
                      <circle
                        className="career-node-pulse"
                        cx={x}
                        cy={[60, 45, 35, 48, 33][index]}
                        fill="#081433"
                        key={x}
                        r="8"
                        stroke="#ffffff"
                        strokeWidth="3"
                      />
                    ))}
                  </svg>
                  <Flag className="absolute right-6 top-0 h-8 w-8 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <SectionCard
            title="Recommended Career Trajectories"
            icon={Target}
            action={
              <label className="relative block w-full sm:w-56">
                <span className="sr-only">Sort career trajectories</span>
                <select
                  className="h-10 w-full cursor-pointer appearance-none rounded-xl border bg-white px-4 pr-10 text-sm font-medium text-[#46536D] shadow-sm outline-none transition hover:border-[#F04D7A] focus:border-[#E00046]"
                  defaultValue="best-match"
                  style={{ borderColor: theme.border }}
                >
                  <option value="best-match">Sort by: Best Match</option>
                  <option value="confidence">Sort by: Confidence</option>
                  <option value="difficulty">Sort by: Difficulty</option>
                  <option value="profiles">Sort by: Similar Profiles</option>
                  <option value="growth">Sort by: Growth Potential</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#46536D]" />
              </label>
            }
          >
            <p className="mb-5 text-sm text-[#46536D]">
              Paths are ranked by match quality and trajectory confidence.
            </p>

            <div className="space-y-4">
              {trajectories.map((trajectory) => (
                <TrajectoryCard
                  key={trajectory.title}
                  trajectory={trajectory}
                />
              ))}
            </div>

            <p className="mt-7 flex items-center justify-center gap-2 text-center text-sm text-[#46536D]">
              <ShieldCheck className="h-4 w-4" />
              Recommendations are based on historical data and AI analysis.
              You&apos;re in control of your career journey.
            </p>
          </SectionCard>

            <div
              className="career-fade-up mt-8 overflow-hidden rounded-2xl p-8 text-white shadow-[0_18px_40px_rgba(21,34,56,0.18)]"
              style={{
                background: `linear-gradient(135deg, ${theme.navy}, ${theme.deepNavy})`,
                animationDelay: "260ms",
              }}
            >
              <div className="grid gap-8 lg:grid-cols-[0.85fr_1.6fr]">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                      <Sparkles className="h-5 w-5 text-[#F04D7A]" />
                    </span>
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        Why this matches you
                      </h2>
                      <p className="mt-1 text-xs font-medium text-white/55">
                        Based on your profile
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-7 text-white/72">
                    Your strongest signals line up with candidate journeys that
                    successfully moved into analytics-focused roles.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {matchSignals.map((signal) => {
                    const Icon = signal.icon;

                    return (
                      <div
                        className="flex h-[210px] min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.08] p-4 backdrop-blur-md"
                        key={signal.title}
                      >
                        <span className="mb-3 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E00046] text-white">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="flex flex-1 flex-col">
                          <h3 className="whitespace-pre-line font-semibold text-white">
                            {signal.title}
                          </h3>
                          <p className="mt-1 text-sm leading-5 text-white/65">
                            {signal.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <details className="career-fade-up mt-8 rounded-2xl border p-5 shadow-sm" style={{ borderColor: theme.line, backgroundColor: "#FFF7FA", animationDelay: "340ms" }}>
              <summary className="cursor-pointer list-none">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-[#E00046]" />
                  <h2 className="font-semibold text-[#081433]">
                    Important to know
                  </h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#46536D]">
                  These are AI-generated blueprints from real candidate journeys.
                  You have the flexibility to explore, combine, or create your own
                  path.
                </p>
                <span className="mt-12 flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-[#E00046] transition hover:translate-x-1">
                  Learn more about matching
                  <ArrowRight className="h-4 w-4" />
                </span>
              </summary>

              <div className="mt-3 grid gap-3 border-t border-[#F5CBD6] pt-4 md:grid-cols-2">
                {[
                  [
                    "What data is used",
                    "Skills, education, projects, experience patterns, and portfolio evidence are compared against similar candidate journeys.",
                  ],
                  [
                    "How ranking works",
                    "Paths with stronger skill overlap, realistic transition timelines, and higher success patterns are ranked first.",
                  ],
                  [
                    "What confidence means",
                    "Confidence reflects how consistent your profile signals are with people who successfully moved into that role.",
                  ],
                  [
                    "How to improve it",
                    "Add stronger project evidence, update portfolio achievements, and close the highest-impact skill gaps.",
                  ],
                ].map(([title, text]) => (
                  <div
                    className="rounded-xl border bg-white p-4"
                    key={title}
                    style={{ borderColor: theme.line }}
                  >
                    <h3 className="text-sm font-semibold text-[#081433]">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#46536D]">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </details>
        </div>
      </section>
    </main>
  );
}
