import { ChatPanel } from "@/components/ai/chat-panel";
import { getChat, getReports, getTasks, getWorkspace } from "@/lib/data";
import { hasModelKey } from "@/lib/server/ai/openai";

// Pillar 2. The ops manager reads the org's own rows through the caller's
// session, so RLS is the boundary rather than a promise in a prompt. It has no
// search tool at all, which is why it can never quietly become a web assistant.
const SUGGESTIONS = [
  "What needs me today?",
  "Which candidates are going cold?",
  "What moved yesterday?",
];

const COLD_AFTER_DAYS = 7;

export default async function OpsPage() {
  const [{ messages, credits }, workspace, reports, tasks] = await Promise.all([
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

  const allowance = credits?.weekly_allowance ?? 0;
  const available = Math.max(
    0,
    allowance - (credits?.used_this_week ?? 0) - (credits?.reserved_this_week ?? 0),
  );

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      <header className="border-b border-rule px-6 py-5">
        <p className="legend text-ink-3">Pillar 2 / AI operations manager</p>
        <h1 className="display mt-2 text-[18px]">Morning brief</h1>
        <p className="mt-2 max-w-[62ch] text-[12px] text-ink-2">
          It reads the {workspace.session.org.name} pipeline, never the open web.
          Ask what moved, what stalled and what needs you today, and it can write
          the follow-ups as tasks.
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

        <ChatPanel
          surface="ops"
          messages={messages}
          available={available}
          weeklyAllowance={allowance}
          resetsAt={credits?.resets_at ?? now.toISOString()}
          configured={hasModelKey()}
          unconfiguredReason="Pulse has no model configured yet, so the ops manager cannot answer. This is a Pulse setup step, not something you need to do."
          placeholder="Ask about your pipeline"
          emptyTitle="Nothing asked yet"
          emptyBody="Ask what moved, what stalled, and who has gone quiet. The answer is built from your own pipeline, and it costs a fraction of a research question."
          suggestions={SUGGESTIONS}
        />
      </div>
    </main>
  );
}
