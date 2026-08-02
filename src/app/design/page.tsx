import {
  Building2,
  Calendar,
  Copy,
  Kanban,
  LayoutDashboard,
  PenLine,
  Plus,
  Radio,
  Search,
  Settings,
  SlidersHorizontal,
  Upload,
  Users,
} from "lucide-react";
import { brand } from "@/config/brand";

// Static taste-lock sheet for DESIGN.md. Not a product screen; the component
// library gets built ticket by ticket after this direction is approved.

type Freshness = "live" | "warm" | "cold";

function PulseDot({ freshness }: { freshness: Freshness }) {
  if (freshness === "cold") {
    return (
      <span className="inline-block size-1.5 rounded-full border-[1.5px] border-warn-500" />
    );
  }
  return (
    <span
      className={`inline-block size-1.5 rounded-full ${
        freshness === "live" ? "bg-pulse-600 pulse-dot-live" : "bg-ink-400"
      }`}
    />
  );
}

function Activity({ freshness, time }: { freshness: Freshness; time: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <PulseDot freshness={freshness} />
      <span className="data-literal">{time}</span>
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-line-soft text-[11px] font-[550] text-ink-600">
      {initials}
    </span>
  );
}

const stageChipStyles: Record<string, string> = {
  Sourced: "bg-line-soft text-ink-600",
  Contacted: "bg-info-500/8 text-info-500",
  Replied: "bg-stage-violet/8 text-stage-violet",
  Interview: "bg-pulse-600/8 text-pulse-700",
  Offer: "bg-warn-500/8 text-warn-500",
  Placed: "bg-pulse-600 text-white",
  Rejected: "bg-line-soft text-ink-400 line-through",
};

function StageChip({ stage }: { stage: string }) {
  return (
    <span
      className={`micro-label inline-flex h-5 items-center rounded-[4px] px-1.5 ${stageChipStyles[stage]}`}
    >
      {stage}
    </span>
  );
}

type Candidate = {
  name: string;
  role: string;
  company: string;
  salary: string;
  freshness: Freshness;
  time: string;
};

const board: { stage: string; candidates: Candidate[] }[] = [
  {
    stage: "Contacted",
    candidates: [
      { name: "Sarah Chen", role: "Platform Engineer", company: "Nortech", salary: "$145k", freshness: "live", time: "3h" },
      { name: "Marcus Webb", role: "Head of Data", company: "Fieldstone", salary: "$180k", freshness: "warm", time: "4d" },
      { name: "Priya Nair", role: "DevOps Lead", company: "Cloudline", salary: "$130k", freshness: "cold", time: "12d" },
    ],
  },
  {
    stage: "Replied",
    candidates: [
      { name: "Tom Okafor", role: "Staff Engineer", company: "Meridian", salary: "$165k", freshness: "live", time: "1h" },
      { name: "Elena Vasquez", role: "Engineering Manager", company: "Brightpath", salary: "$155k", freshness: "warm", time: "3d" },
    ],
  },
  {
    stage: "Interview",
    candidates: [
      { name: "James Park", role: "VP Engineering", company: "Corewave", salary: "$210k", freshness: "live", time: "6h" },
      { name: "Ana Duarte", role: "Principal SRE", company: "Halston", salary: "$175k", freshness: "cold", time: "9d" },
    ],
  },
  {
    stage: "Offer",
    candidates: [
      { name: "Ryan Mitchell", role: "CTO", company: "Vantora", salary: "$240k", freshness: "live", time: "45m" },
    ],
  },
];

const nav = [
  { label: "Dashboard", icon: LayoutDashboard, active: false },
  { label: "Pipeline", icon: Kanban, active: true },
  { label: "Candidates", icon: Users, active: false },
  { label: "Companies", icon: Building2, active: false },
  { label: "Signals", icon: Radio, active: false },
  { label: "Scheduling", icon: Calendar, active: false },
  { label: "Content", icon: PenLine, active: false },
  { label: "Settings", icon: Settings, active: false },
];

export default function DesignSheet() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex h-12 items-center gap-2 border-b border-line-soft px-4">
          <span className="size-2 rounded-full bg-pulse-600 pulse-dot-live" />
          <span className="text-[14px] font-[590] tracking-[-0.01em]">
            {brand.name}
          </span>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {nav.map(({ label, icon: Icon, active }) => (
            <a
              key={label}
              href="#"
              className={`flex h-8 items-center gap-2.5 rounded-control px-2.5 text-[13px] ${
                active
                  ? "bg-pulse-50 font-[550] text-pulse-700"
                  : "text-ink-600 hover:bg-canvas hover:text-ink-900"
              }`}
            >
              <Icon size={16} strokeWidth={1.5} />
              {label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-auto">
        {/* Topbar */}
        <div className="flex h-12 items-center justify-between border-b border-line bg-surface px-6">
          <div className="flex h-8 w-72 items-center gap-2 rounded-control border border-line bg-canvas px-2.5 text-ink-400">
            <Search size={16} strokeWidth={1.5} />
            <span className="text-[13px]">Search candidates, companies</span>
            <kbd className="ml-auto rounded-[4px] border border-line bg-surface px-1 font-mono text-[11px] text-ink-400">
              /
            </kbd>
          </div>
          <Avatar name="Daniyal Aziz" />
        </div>

        <div className="p-6">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <h1 className="text-[20px] font-[590] leading-7 tracking-[-0.01em]">
                Pipeline
              </h1>
              <span className="data-literal">128 candidates</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex h-8 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-[13px] font-[550] text-ink-900 hover:bg-canvas">
                <Upload size={16} strokeWidth={1.5} />
                Import
              </button>
              <button className="flex h-8 items-center gap-1.5 rounded-control bg-pulse-600 px-3 text-[13px] font-[550] text-white hover:bg-pulse-700">
                <Plus size={16} strokeWidth={1.5} />
                Add candidate
              </button>
            </div>
          </div>

          {/* Filter bar */}
          <div className="mt-4 flex items-center gap-2">
            <button className="flex h-7 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 text-[13px] text-ink-600 hover:bg-canvas">
              <SlidersHorizontal size={14} strokeWidth={1.5} />
              Filter
            </button>
            <span className="flex h-7 items-center gap-1 rounded-control bg-pulse-50 px-2.5 text-[13px] text-pulse-700">
              Role: Engineering
            </span>
            <span className="flex h-7 items-center gap-1 rounded-control bg-pulse-50 px-2.5 text-[13px] text-pulse-700">
              Owner: Me
            </span>
          </div>

          {/* Board */}
          <div className="mt-5 flex gap-3">
            {board.map(({ stage, candidates }) => (
              <div key={stage} className="w-70 shrink-0">
                <div className="flex items-center justify-between px-1 pb-2">
                  <span className="micro-label">{stage}</span>
                  <span className="data-literal">{candidates.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {candidates.map((c) => (
                    <div
                      key={c.name}
                      className="cursor-pointer rounded-card border border-line bg-surface p-3 hover:border-ink-400"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar name={c.name} />
                        <span className="text-[13px] font-[550] leading-[18px]">
                          {c.name}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-[18px] text-ink-600">
                        {c.role} at {c.company}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="data-literal">{c.salary}</span>
                        <Activity freshness={c.freshness} time={c.time} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Table sample */}
          <h2 className="mt-8 text-[16px] font-[590] leading-6">
            Recently added
          </h2>
          <div className="mt-3 overflow-hidden rounded-card border border-line bg-surface">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Name", "Stage", "Role", "Email", "Last activity"].map(
                    (h) => (
                      <th key={h} className="micro-label h-9 px-4 font-[550]">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Sarah Chen", stage: "Contacted", role: "Platform Engineer", email: "sarah@nortech.io", freshness: "live" as const, time: "3h" },
                  { name: "James Park", stage: "Interview", role: "VP Engineering", email: "jpark@corewave.com", freshness: "live" as const, time: "6h" },
                  { name: "Ryan Mitchell", stage: "Offer", role: "CTO", email: "ryan@vantora.co", freshness: "live" as const, time: "45m" },
                  { name: "Priya Nair", stage: "Sourced", role: "DevOps Lead", email: "priya.nair@cloudline.dev", freshness: "cold" as const, time: "12d" },
                  { name: "Dana Whitfield", stage: "Placed", role: "Head of Product", email: "dana@meridian.com", freshness: "warm" as const, time: "5d" },
                ].map((r) => (
                  <tr
                    key={r.name}
                    className="border-b border-line-soft last:border-0 hover:bg-canvas"
                  >
                    <td className="h-10 px-4">
                      <span className="flex items-center gap-2 text-[13px] font-[550]">
                        <Avatar name={r.name} />
                        {r.name}
                      </span>
                    </td>
                    <td className="h-10 px-4">
                      <StageChip stage={r.stage} />
                    </td>
                    <td className="h-10 px-4 text-[13px] text-ink-600">
                      {r.role}
                    </td>
                    <td className="h-10 px-4">
                      <span className="group flex cursor-pointer items-center gap-1.5">
                        <span className="data-literal">{r.email}</span>
                        <Copy
                          size={13}
                          strokeWidth={1.5}
                          className="text-ink-400 opacity-0 group-hover:opacity-100"
                        />
                      </span>
                    </td>
                    <td className="h-10 px-4">
                      <Activity freshness={r.freshness} time={r.time} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Primitive strip */}
          <h2 className="mt-8 text-[16px] font-[590] leading-6">Primitives</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4">
            <button className="h-8 rounded-control bg-pulse-600 px-3 text-[13px] font-[550] text-white hover:bg-pulse-700">
              Add candidate
            </button>
            <button className="h-8 rounded-control border border-line bg-surface px-3 text-[13px] font-[550] hover:bg-canvas">
              Export list
            </button>
            <button className="h-8 rounded-control px-3 text-[13px] font-[550] text-ink-600 hover:bg-canvas hover:text-ink-900">
              Cancel
            </button>
            <button className="h-8 rounded-control border border-danger-500/30 px-3 text-[13px] font-[550] text-danger-500 hover:bg-danger-500/5">
              Delete candidate
            </button>
            <input
              placeholder="candidate@company.com"
              className="h-8 w-56 rounded-control border border-line bg-surface px-2.5 text-[13px] placeholder:text-ink-400"
            />
            {Object.keys(stageChipStyles).map((s) => (
              <StageChip key={s} stage={s} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
