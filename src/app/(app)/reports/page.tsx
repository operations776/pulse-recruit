import type { ReactNode } from "react";
import { Breadcrumb, StatusChip } from "@/components/ui/misc";
import { getReports } from "@/lib/data";
import type { JobState } from "@/lib/supabase/types";

// Every figure on this screen is counted from the rows getReports returned.
// Nothing is hardcoded and nothing is estimated, so a number that looks wrong
// is a data problem, never a display problem.

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
    <div className="rounded-card border border-rule bg-sheet p-4">
      <p className="legend text-ink-2">{label}</p>
      <p className="display mt-2 text-[21px] tabular-nums">{value}</p>
      <p className="mt-1 text-[12px] leading-[1.4] text-ink-2">{sub}</p>
    </div>
  );
}

function Num({ children }: { children: ReactNode }) {
  return <span className="meta text-inherit">{children}</span>;
}

function StateChip({ state }: { state: JobState }) {
  if (state === "open") return <StatusChip tone="on">Open</StatusChip>;
  if (state === "risk") return <StatusChip tone="attention">At risk</StatusChip>;
  return <StatusChip tone="off">Closed</StatusChip>;
}

export default async function ReportsPage() {
  const { candidates, jobs, stages } = await getReports();

  const liveRoles = jobs.filter((j) => j.state === "open");
  const atRisk = jobs.filter((j) => j.state === "risk");
  const hired = jobs.reduce((sum, j) => sum + j.hired, 0);
  const target = jobs.reduce((sum, j) => sum + j.target, 0);

  // Stage rows are per role, so the same names repeat. The bars count by the
  // name a recruiter reads, ordered by the position the board uses.
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
    count: candidates.filter((c) => nameByStageId.get(c.stage_id) === name)
      .length,
  }));
  const peak = Math.max(1, ...stageCounts.map((s) => s.count));

  const countByJob = new Map<string, number>();
  for (const c of candidates) {
    countByJob.set(c.job_id, (countByJob.get(c.job_id) ?? 0) + 1);
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-paper">
      <div className="px-6 pt-4">
        <Breadcrumb trail={["Talent", "Reports"]} />
        <h1 className="display mt-2 text-[18px]">Reports</h1>
      </div>

      <div className="flex flex-col gap-5 px-6 pb-8 pt-5">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Live candidates"
            value={String(candidates.length)}
            sub="Everyone on the pipeline, archived people excluded"
          />
          <StatTile
            label="Open roles"
            value={String(liveRoles.length)}
            sub={
              <>
                Of <Num>{jobs.length}</Num> roles on the book
              </>
            }
          />
          <StatTile
            label="Hired"
            value={String(hired)}
            sub={
              <>
                Against a target of <Num>{target}</Num>
              </>
            }
          />
          <StatTile
            label="Roles at risk"
            value={String(atRisk.length)}
            sub="Roles the team has flagged as slipping"
          />
        </div>

        <section className="rounded-shell border border-rule bg-sheet">
          <div className="border-b border-rule px-4 py-3">
            <h2 className="display text-[13px]">Pipeline by stage</h2>
            <p className="mt-1 text-[12px] leading-[1.4] text-ink-2">
              Candidates at each stage, counted across every role.
            </p>
          </div>

          <div className="flex flex-col gap-3 px-4 py-4">
            {stageCounts.length === 0 ? (
              <p className="text-[12px] text-ink-2">
                No stages exist yet, so there is nothing to count.
              </p>
            ) : (
              stageCounts.map((stage) => (
                <div key={stage.name} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[12px]">
                    {stage.name}
                  </span>
                  <span className="h-2 min-w-0 flex-1 rounded-chip bg-well">
                    <span
                      className="block h-2 rounded-chip bg-ink"
                      style={{ width: `${(stage.count / peak) * 100}%` }}
                    />
                  </span>
                  <span className="meta w-8 shrink-0 text-right text-ink-2">
                    {stage.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-shell border border-rule bg-sheet">
          <div className="border-b border-rule px-4 py-3">
            <h2 className="display text-[13px]">Roles</h2>
            <p className="mt-1 text-[12px] leading-[1.4] text-ink-2">
              Every role on the book with its live headcount.
            </p>
          </div>

          {jobs.length === 0 ? (
            <p className="px-4 py-6 text-[12px] text-ink-2">
              No roles have been opened in this workspace yet.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-rule">
                  <th scope="col" className="legend h-9 px-4 text-left text-ink-2">
                    Role
                  </th>
                  <th scope="col" className="legend h-9 px-4 text-left text-ink-2">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="legend h-9 px-4 text-right text-ink-2"
                  >
                    Candidates
                  </th>
                  <th
                    scope="col"
                    className="legend h-9 px-4 text-right text-ink-2"
                  >
                    Hired
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-rule last:border-0">
                    <td className="h-11 px-4">
                      <span className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">
                          {job.title}
                        </span>
                        <span className="record-id text-ink-3">{job.ref}</span>
                      </span>
                    </td>
                    <td className="h-11 px-4">
                      <StateChip state={job.state} />
                    </td>
                    <td className="meta h-11 px-4 text-right text-ink">
                      {countByJob.get(job.id) ?? 0}
                    </td>
                    <td className="meta h-11 px-4 text-right text-ink">
                      {job.hired}/{job.target}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
