import {
  Archive,
  Bell,
  Briefcase,
  ChartNoAxesColumn,
  ChevronsLeft,
  ChevronDown,
  CircleHelp,
  FileText,
  Folder,
  Inbox,
  LayoutGrid,
  MessageSquare,
  MoveRight,
  Newspaper,
  Plus,
  Search,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MatchScore } from "@/components/ui/match-score";
import { MetricRow, type Metrics } from "@/components/ui/metric-row";
import { Activity, type Freshness } from "@/components/ui/pulse-dot";
import { brand } from "@/config/brand";
import { hueBg, hueByIndex, hueTint } from "@/lib/hue";

// Taste-lock sheet for the product interior, judged against DESIGN.md.
// Static by design: the real screens get built ticket by ticket.

type Candidate = {
  name: string;
  email: string;
  phone: string;
  metrics: Metrics;
  match: number;
  freshness: Freshness;
  time: string;
  selected?: boolean;
};

const columns: { stage: string; candidates: Candidate[] }[] = [
  {
    stage: "Applied",
    candidates: [
      { name: "Laurie Kessler", email: "laurie.kessler@nortech.io", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 0 }, match: 72, freshness: "live", time: "3h" },
      { name: "Clementine Spencer", email: "c.spencer@fieldstone.com", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 0 }, match: 98, freshness: "live", time: "5h", selected: true },
      { name: "Karlie Pfannerstill", email: "karlie.p@brightpath.dev", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 0 }, match: 49, freshness: "warm", time: "4d" },
      { name: "Rylee Thiel", email: "rylee@cloudline.dev", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 0 }, match: 68, freshness: "cold", time: "12d", selected: true },
      { name: "Alysa Kunde", email: "alysa.kunde@meridian.co", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 0 }, match: 77, freshness: "warm", time: "6d" },
    ],
  },
  {
    stage: "Test",
    candidates: [
      { name: "Berry Shields", email: "berry.shields@corewave.com", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 0 }, match: 100, freshness: "live", time: "1h" },
      { name: "Fay Nitzsche", email: "fay@halston.io", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 0 }, match: 98, freshness: "live", time: "2h" },
      { name: "Jace Hackett", email: "jace.hackett@vantora.co", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 0 }, match: 82, freshness: "warm", time: "3d" },
    ],
  },
  {
    stage: "Interview",
    candidates: [
      { name: "Daisy Ullrich", email: "daisy.ullrich@nortech.io", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 2 }, match: 100, freshness: "live", time: "45m" },
      { name: "Aaron Johnson", email: "aaron.j@fieldstone.com", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 1 }, match: 86, freshness: "live", time: "6h" },
      { name: "Abigail Thompson", email: "abigail@brightpath.dev", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 1 }, match: 79, freshness: "warm", time: "2d" },
      { name: "Felix Garcia", email: "felix.garcia@corewave.com", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 3 }, match: 91, freshness: "cold", time: "9d" },
    ],
  },
  {
    stage: "Offer",
    candidates: [
      { name: "Eleanor Taylor", email: "eleanor.taylor@vantora.co", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 4 }, match: 96, freshness: "live", time: "20m" },
      { name: "Daniel Brown", email: "daniel.brown@halston.io", phone: "555 666 77", metrics: { emails: 1, notes: 3, documents: 2, interviews: 2 }, match: 88, freshness: "warm", time: "3d" },
    ],
  },
];

const positions = [
  { title: "Senior Product Design", code: "P_001", state: "open" },
  { title: "Middle Business Analyst", code: "P_002", state: "open" },
  { title: "Assistant Product Manager", code: "P_003", state: "risk" },
  { title: "Scrum Master", code: "P_004", state: "open" },
  { title: "UX Writer", code: "P_006", state: "open" },
  { title: "Middle Project Manager", code: "P_005", state: "closed" },
  { title: "UX Research", code: "P_007", state: "closed" },
];

const stateDot: Record<string, string> = {
  open: "bg-emerald-500",
  risk: "bg-hue-amber",
  closed: "bg-ink-400",
};

const railNav = [
  { icon: Users, label: "Candidates", active: true },
  { icon: Folder, label: "Pipelines", active: false },
  { icon: Briefcase, label: "Jobs", active: false },
  { icon: Inbox, label: "Inbox", active: false },
  { icon: FileText, label: "Documents", active: false },
  { icon: ChartNoAxesColumn, label: "Reports", active: false },
];

const workspaces = [
  { name: "Nortech", key: "nortech" },
  { name: "Pulse Talent", key: "pulse-talent" },
];

const tabs = [
  { label: "Candidate", icon: Users, active: true },
  { label: "Job News", icon: Newspaper, active: false },
  { label: "Channel", icon: MessageSquare, active: false },
  { label: "Report", icon: ChartNoAxesColumn, active: false },
];

function CandidateCard({ c }: { c: Candidate }) {
  return (
    <div
      className={`group relative cursor-pointer rounded-xl border bg-surface p-3 shadow-card transition-colors duration-150 ${
        c.selected
          ? "border-emerald-600 ring-1 ring-emerald-600"
          : "border-line hover:border-ink-400"
      }`}
    >
      <span
        className={`absolute right-3 top-3 flex size-4 items-center justify-center rounded-[5px] border ${
          c.selected
            ? "border-emerald-600 bg-emerald-600"
            : "border-line bg-surface opacity-0 group-hover:opacity-100"
        }`}
      >
        {c.selected ? (
          <svg viewBox="0 0 10 8" className="size-2.5 fill-none stroke-white stroke-2">
            <path d="M1 4l2.5 2.5L9 1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>

      <div className="flex items-start gap-2.5 pr-6">
        <Avatar name={c.name} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-[18px]">
            {c.name}
          </p>
          <p className="truncate text-[12px] leading-4 text-ink-600">
            {c.email}
          </p>
          <p className="data-literal text-[12px] text-ink-400">{c.phone}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-soft pt-2.5">
        <MetricRow metrics={c.metrics} />
        <span className="flex items-center gap-2.5">
          <Activity freshness={c.freshness} label={c.time} />
          <MatchScore value={c.match} />
        </span>
      </div>
    </div>
  );
}

export default function DesignSheet() {
  const selectedCount = columns
    .flatMap((col) => col.candidates)
    .filter((c) => c.selected).length;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex h-13 shrink-0 items-center justify-between bg-forest-900 px-3 text-white">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-lg px-1.5 py-1">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600">
              <span className="size-2 rounded-full bg-white" />
            </span>
            <span className="font-display text-[15px] font-semibold">
              {brand.name}
            </span>
          </span>
          <span className="h-5 w-px bg-white/15" />
          <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-white/90 hover:bg-white/10">
            Elio Tran
            <ChevronDown size={14} strokeWidth={2} className="text-white/60" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-white/80 hover:bg-white/10">
            <CircleHelp size={15} strokeWidth={1.75} />
            Need help?
          </button>
          <button className="relative rounded-lg p-2 text-white/80 hover:bg-white/10">
            <Bell size={15} strokeWidth={1.75} />
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-hue-coral" />
          </button>
          <span className="ml-1">
            <Avatar name="Daniyal Aziz" size="sm" />
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Icon rail */}
        <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3">
          {workspaces.map((w, i) => {
            const hue = hueByIndex(i);
            return (
              <button
                key={w.key}
                title={w.name}
                className={`flex size-8 items-center justify-center rounded-lg text-[12px] font-bold text-white ${hueBg[hue]} ${
                  i === 0 ? "ring-2 ring-ink-900 ring-offset-2" : ""
                }`}
              >
                {w.name[0]}
              </button>
            );
          })}
          <button
            title="Add workspace"
            className="flex size-8 items-center justify-center rounded-lg border border-dashed border-line text-ink-400 hover:border-ink-400 hover:text-ink-600"
          >
            <Plus size={15} strokeWidth={2} />
          </button>

          <span className="my-2 h-px w-6 bg-line" />

          {railNav.map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              title={label}
              className={`flex size-8 items-center justify-center rounded-lg ${
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-ink-400 hover:bg-canvas hover:text-ink-600"
              }`}
            >
              <Icon size={17} strokeWidth={1.75} />
            </button>
          ))}

          <span className="mt-auto flex flex-col gap-1">
            <button
              title="Settings"
              className="flex size-8 items-center justify-center rounded-lg text-ink-400 hover:bg-canvas hover:text-ink-600"
            >
              <Settings size={17} strokeWidth={1.75} />
            </button>
          </span>
        </nav>

        {/* List panel */}
        <aside className="flex w-66 shrink-0 flex-col border-r border-line bg-surface">
          <div className="flex h-12 items-center justify-between px-3">
            <span className="flex items-center gap-2">
              <LayoutGrid size={15} strokeWidth={1.75} className="text-hue-indigo" />
              <span className="text-[13px] font-semibold">Campaign Q2.2024</span>
            </span>
            <button className="rounded-md p-1 text-ink-400 hover:bg-canvas">
              <ChevronsLeft size={15} strokeWidth={1.75} />
            </button>
          </div>

          <div className="px-3 pb-2">
            <span className="flex h-8 items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 text-ink-400">
              <Search size={14} strokeWidth={1.75} />
              <span className="text-[12px]">Search position</span>
            </span>
          </div>

          <div className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-2">
            {positions.map((p, i) => (
              <button
                key={p.code}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-left ${
                  i === 0 ? "bg-emerald-50" : "hover:bg-canvas"
                }`}
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${stateDot[p.state]}`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[13px] ${
                      i === 0 ? "font-semibold text-emerald-700" : "text-ink-900"
                    }`}
                  >
                    {p.title}
                  </span>
                  <span className="data-literal text-[11px] text-ink-400">
                    {p.code}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="relative min-w-0 flex-1 overflow-auto bg-canvas">
          <div className="px-6 pt-4">
            <nav className="flex items-center gap-1.5 text-[12px] text-ink-400">
              <span>Recruitment</span>
              <span>/</span>
              <span>Campaign</span>
              <span>/</span>
              <span className="text-ink-600">Campaign Q2.2024</span>
            </nav>

            <h1 className="mt-2 font-display text-[22px] font-semibold leading-7 tracking-[-0.01em]">
              Senior Product Design
            </h1>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="text-[12px] text-ink-600">
                Talent pool:{" "}
                <span className="font-medium text-ink-900">Product design</span>
              </span>
              <span className="text-[12px] text-ink-600">
                Hired: <span className="data-literal text-ink-900">1/10</span>
              </span>
              <span className="text-[12px] text-ink-600">
                Time:{" "}
                <span className="data-literal text-ink-900">
                  01/01/26 - 01/02/26
                </span>
              </span>
              <span className="flex items-center gap-2 text-[12px] text-ink-600">
                Assigned to:
                <AvatarStack names={["Reyhan Khan", "Salar Mansoor", "Daniyal Aziz"]} />
                <button className="flex size-6 items-center justify-center rounded-full border border-dashed border-line text-ink-400 hover:border-ink-400 hover:text-ink-600">
                  <Plus size={12} strokeWidth={2} />
                </button>
              </span>
            </div>

            <div className="mt-4 flex items-end justify-between border-b border-line">
              <div className="flex items-center gap-1">
                {tabs.map(({ label, icon: Icon, active }) => (
                  <button
                    key={label}
                    className={`flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-[13px] ${
                      active
                        ? "border-emerald-600 font-semibold text-emerald-700"
                        : "border-transparent text-ink-600 hover:text-ink-900"
                    }`}
                  >
                    <Icon size={15} strokeWidth={1.75} />
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pb-2">
                <span className="flex h-[34px] w-56 items-center gap-2 rounded-full border border-line bg-surface px-3 text-ink-400">
                  <Search size={14} strokeWidth={1.75} />
                  <span className="text-[12px]">Search candidate</span>
                </span>
                <Button variant="primary">
                  <Plus size={15} strokeWidth={2.25} />
                  Add candidate
                </Button>
              </div>
            </div>
          </div>

          {/* Board */}
          <div className="flex gap-3 px-6 pb-28 pt-4">
            {columns.map(({ stage, candidates }, columnIndex) => {
              const hue = hueByIndex(columnIndex);
              return (
                <section key={stage} className="w-71 shrink-0">
                  <div className="mb-2.5 flex items-center gap-2">
                    <span
                      className={`flex size-5 items-center justify-center rounded-md ${hueTint[hue]}`}
                    >
                      <span className={`size-2 rounded-[3px] ${hueBg[hue]}`} />
                    </span>
                    <span className="text-[13px] font-semibold">{stage}</span>
                    <span className="data-literal rounded-full bg-line-soft px-1.5 text-[11px] text-ink-600">
                      {candidates.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {candidates.map((c) => (
                      <CandidateCard key={c.name} c={c} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Bulk action bar */}
          <div className="pointer-events-none sticky bottom-6 flex justify-center px-6">
            <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-forest-900 py-2 pl-4 pr-2 text-white shadow-pop">
              <span className="data-literal text-[12px] text-white/70">
                {selectedCount} selected
              </span>
              <span className="mx-2 h-4 w-px bg-white/15" />
              <button className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium hover:bg-white/10">
                <MoveRight size={14} strokeWidth={1.75} />
                Move
              </button>
              <button className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium hover:bg-white/10">
                <Archive size={14} strokeWidth={1.75} />
                Archive
              </button>
              <button className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-hue-coral hover:bg-white/10">
                <Trash2 size={14} strokeWidth={1.75} />
                Delete
              </button>
              <span className="mx-2 h-4 w-px bg-white/15" />
              <span className="data-literal pr-2 text-[11px] text-white/50">
                esc to deselect
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
