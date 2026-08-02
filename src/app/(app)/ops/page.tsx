import { ChatPanel } from "@/components/ai/chat-panel";
import { getChat, getReports, getTasks, getWorkspace } from "@/lib/data";

// Pillar 2. The ops manager reads your pipeline, never the open web, so these
// answers cost no credits and the screen carries no meter.
const SUGGESTIONS = [
  "What needs me today?",
  "Which candidates are going cold?",
  "What moved yesterday?",
];

const COLD_AFTER_DAYS = 7;

export default async function OpsPage() {
  const [{ messages }, workspace, reports, tasks] = await Promise.all([
    getChat("ops"),
    getWorkspace(),
    getReports(),
    getTasks(),
  ]);

  // Measured against real wall clock time, not a fixed seed date. A tile that
  // is stale by a day is worse than no tile.
  const now = new Date();
  const coldBefore = now.getTime() - COLD_AFTER_DAYS * 86_400_000;

  // getReports already excludes archived candidates, so every one of these is
  // live by definition.
  const live = reports.candidates;
  const atRisk = reports.jobs.filter((j) => j.state === "risk");
  const cold = live.filter(
    (c) => new Date(c.last_activity_at).getTime() < coldBefore,
  );
  const openTasks = tasks.filter((t) => t.done_at === null);

  const tiles = [
    { label: "Live candidates", value: live.length },
    { label: "Roles at risk", value: atRisk.length },
    { label: "Going cold", value: cold.length },
    { label: "Open tasks", value: openTasks.length },
  ];

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      <header className="border-b border-rule px-6 py-5">
        <p className="legend text-ink-3">Pillar 2 / AI operations manager</p>
        <h1 className="display mt-2 text-[18px]">Morning brief</h1>
        <p className="mt-2 max-w-[62ch] text-[12px] text-ink-2">
          It reads the {workspace.session.org.name} pipeline, not the open web.
          Ask it what moved, what stalled and what needs you today.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 p-6">
        <div className="grid shrink-0 grid-cols-4 gap-3">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-card border border-rule bg-sheet p-3"
            >
              <p className="legend text-ink-2">{tile.label}</p>
              <p className="display mt-1.5 text-[21px]">{tile.value}</p>
            </div>
          ))}
        </div>

        {/* No credit meter: an ops answer reads your own records and costs
            nothing, so there is no allowance to show. */}
        <ChatPanel
          surface="ops"
          messages={messages}
          creditsLeft={0}
          weeklyAllowance={0}
          resetsAt={now.toISOString()}
          placeholder="Ask about your pipeline"
          emptyTitle="Nothing asked yet"
          emptyBody="Ask what moved, what stalled, and who has gone quiet. The answer is built from your own pipeline and it costs nothing to ask."
          suggestions={SUGGESTIONS}
        />
      </div>
    </main>
  );
}
