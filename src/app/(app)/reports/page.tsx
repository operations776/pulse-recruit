"use client";

import type { ReactNode } from "react";
import { Badge, Breadcrumb } from "@/components/ui/misc";
import { hueBg, hueByIndex } from "@/lib/hue";
import { useStore } from "@/lib/store";
import type { Job } from "@/lib/types";

// Every figure on this screen is derived from the store. Nothing is hardcoded,
// so the page stays honest the moment the data layer becomes Supabase.

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: ReactNode;
}) {
  return (
    <div className="rounded-sharp border border-rule bg-paper-white p-4">
      <p className="micro-label text-ink-soft">{label}</p>
      <p className="mt-2 font-mono text-[24px] font-semibold leading-[30px] tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-[12px] leading-4 text-ink-mute">{sub}</p>
    </div>
  );
}

function Num({ children }: { children: ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>;
}

const STATUS_LABEL: Record<Job["state"], string> = {
  open: "Open",
  risk: "At risk",
  closed: "Closed",
};

function StatusBadge({ state }: { state: Job["state"] }) {
  if (state === "open") return <Badge hue="accent">{STATUS_LABEL.open}</Badge>;
  if (state === "risk") return <Badge hue="mustard">{STATUS_LABEL.risk}</Badge>;
  return <Badge hue="neutral">{STATUS_LABEL.closed}</Badge>;
}

export default function ReportsPage() {
  const { state, jobs, stages, candidatesForJob } = useStore();

  const candidates = state.candidates.filter(
    (c) => !state.archivedIds.includes(c.id),
  );

  const liveRoles = jobs.filter((j) => j.state === "open");
  const placed = jobs.reduce((sum, j) => sum + j.hired, 0);
  const target = jobs.reduce((sum, j) => sum + j.target, 0);
  const averageMatch = candidates.length
    ? Math.round(
        candidates.reduce((sum, c) => sum + c.match, 0) / candidates.length,
      )
    : 0;

  // Stage names come from the seeded stage set, ordered by position, so the
  // five columns of the board and the five bars here can never drift apart.
  const nameByPosition = new Map<number, string>();
  for (const s of stages) {
    if (!nameByPosition.has(s.position)) nameByPosition.set(s.position, s.name);
  }
  const stageNames = [...nameByPosition.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, name]) => name);

  const nameByStageId = new Map(stages.map((s) => [s.id, s.name]));
  const stageCounts = stageNames.map((name) => ({
    name,
    count: candidates.filter((c) => nameByStageId.get(c.stageId) === name)
      .length,
  }));
  const peak = Math.max(1, ...stageCounts.map((s) => s.count));

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-paper">
      <div className="px-6 pt-4">
        <Breadcrumb trail={["Recruitment", "Reports"]} />

        <h1 className="mt-2 font-display text-[22px] font-semibold leading-7 tracking-[-0.01em]">
          Reports
        </h1>
      </div>

      <div className="flex flex-col gap-4 px-6 pb-8 pt-5">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Total candidates"
            value={String(candidates.length)}
            sub="Everyone on the live pipeline"
          />
          <StatTile
            label="Live roles"
            value={String(liveRoles.length)}
            sub={<>Of <Num>{jobs.length}</Num> roles on the board</>}
          />
          <StatTile
            label="Placed this quarter"
            value={String(placed)}
            sub={<>Against a target of <Num>{target}</Num></>}
          />
          <StatTile
            label="Average match score"
            value={`${averageMatch}%`}
            sub="Mean score across every candidate"
          />
        </div>

        <section className="rounded-sharp border border-rule bg-paper-white">
          <div className="border-b border-rule px-4 py-3">
            <h2 className="text-[16px] font-semibold leading-[22px]">
              Pipeline by stage
            </h2>
            <p className="mt-0.5 text-[12px] leading-4 text-ink-soft">
              Candidates at each stage, counted across every role.
            </p>
          </div>

          <div className="flex flex-col gap-3 px-4 py-4">
            {stageCounts.map((stage, i) => (
              <div key={stage.name} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[13px] leading-[18px]">
                  {stage.name}
                </span>
                <span className="h-2 min-w-0 flex-1 rounded-full bg-rule">
                  <span
                    className={`block h-2 rounded-full ${hueBg[hueByIndex(i)]}`}
                    style={{ width: `${(stage.count / peak) * 100}%` }}
                  />
                </span>
                <span className="data-literal w-8 shrink-0 text-right text-ink-soft">
                  {stage.count}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-sharp border border-rule bg-paper-white">
          <div className="border-b border-rule px-4 py-3">
            <h2 className="text-[16px] font-semibold leading-[22px]">Roles</h2>
            <p className="mt-0.5 text-[12px] leading-4 text-ink-soft">
              Every role on the board with its live headcount.
            </p>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-rule">
                <th className="micro-label h-11 px-4 text-left text-ink-soft">
                  Role
                </th>
                <th className="micro-label h-11 px-4 text-left text-ink-soft">
                  Status
                </th>
                <th className="micro-label h-11 px-4 text-right text-ink-soft">
                  Candidates
                </th>
                <th className="micro-label h-11 px-4 text-right text-ink-soft">
                  Hired
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-rule last:border-0">
                  <td className="h-11 px-4">
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] leading-[18px] font-medium">
                        {job.title}
                      </span>
                      <span className="data-literal text-ink-mute">
                        {job.code}
                      </span>
                    </span>
                  </td>
                  <td className="h-11 px-4">
                    <StatusBadge state={job.state} />
                  </td>
                  <td className="data-literal h-11 px-4 text-right text-ink">
                    {candidatesForJob(job.id).length}
                  </td>
                  <td className="data-literal h-11 px-4 text-right text-ink">
                    {job.hired}/{job.target}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
