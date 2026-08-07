"use client";

import { Mail, MessageSquare, Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { EmptyState, StatusChip, type Tone } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { setSequenceStatus, updateStep } from "@/lib/actions";
import type {
  MailboxRow,
  SequenceRow,
  SequenceStepRow,
  SignalKind,
} from "@/lib/supabase/types";

// Status is colour plus icon plus word (DESIGN.md rule 9). The chip carries the
// icon, this map carries the word, so a paused sequence never reads as running
// on a bad monitor.
const STATUS: Record<SequenceRow["status"], { tone: Tone; word: string }> = {
  running: { tone: "on", word: "Running" },
  paused: { tone: "attention", word: "Paused" },
  draft: { tone: "off", word: "Draft" },
};

// The trigger is written out as a sentence rather than shown as a raw enum,
// because the recruiter needs to know what actually puts a person into this
// sequence before editing a word of the copy.
const TRIGGER: Record<SignalKind, string> = {
  funding: "Runs when a Dream 100 company posts a funding signal",
  promotion: "Runs when somebody at a Dream 100 company is promoted",
  open_role: "Runs when a Dream 100 company reposts an open role",
  leadership: "Runs when a Dream 100 company brings in a new leader",
  expansion: "Runs when a Dream 100 company signals expansion",
};

const CHANNEL = {
  email: { word: "Email", icon: Mail },
  linkedin: { word: "LinkedIn", icon: MessageSquare },
} as const;

type Edit = { subject?: string; body?: string };

export function SequenceWorkbench({
  sequences,
  steps,
  mailboxes,
  links,
}: {
  sequences: SequenceRow[];
  steps: SequenceStepRow[];
  mailboxes: MailboxRow[];
  links: { sequence_id: string; mailbox_id: string }[];
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  const [selectedId, setSelectedId] = useState(sequences[0]?.id ?? "");

  // The step editors are controlled by this map, not by the server props.
  // updateStep deliberately does not revalidate, and a refresh under an open
  // editor remounts it and drops the caret. Local state is what keeps typing
  // survivable across any refresh the rest of the screen triggers.
  const [edits, setEdits] = useState<Record<string, Edit>>({});

  const selected =
    sequences.find((q) => q.id === selectedId) ?? sequences[0] ?? null;

  const stepsBySequence = useMemo(() => {
    const map = new Map<string, SequenceStepRow[]>();
    for (const step of steps) {
      const list = map.get(step.sequence_id);
      if (list) list.push(step);
      else map.set(step.sequence_id, [step]);
    }
    return map;
  }, [steps]);

  const mailboxById = useMemo(
    () => new Map(mailboxes.map((m) => [m.id, m])),
    [mailboxes],
  );

  const enrolled = sequences.reduce((sum, q) => sum + q.enrolled, 0);
  const replied = sequences.reduce((sum, q) => sum + q.replied, 0);
  const booked = sequences.reduce((sum, q) => sum + q.booked, 0);
  // Guard the divide: a fleet of drafts has no enrolments and no reply rate.
  const replyRate = enrolled === 0 ? 0 : Math.round((replied / enrolled) * 100);

  const stats: [string, string][] = [
    ["Enrolled", String(enrolled)],
    ["Replied", String(replied)],
    ["Booked", String(booked)],
    ["Reply rate", `${replyRate}%`],
  ];

  const valueOf = (step: SequenceStepRow, field: "subject" | "body") => {
    const edit = edits[step.id];
    if (edit && edit[field] !== undefined) return edit[field] as string;
    return field === "subject" ? (step.subject ?? "") : step.body;
  };

  const edit = (stepId: string, patch: Edit) => {
    setEdits((prev) => ({ ...prev, [stepId]: { ...prev[stepId], ...patch } }));
  };

  // Saved on blur. Nothing refreshes afterwards, so the caret stays where the
  // recruiter left it and the next field is still the next field.
  const save = (
    step: SequenceStepRow,
    field: "subject" | "body",
    label: number,
  ) => {
    const next = valueOf(step, field);
    const current = field === "subject" ? (step.subject ?? "") : step.body;
    if (next === current) return;

    const patch: Edit = field === "subject" ? { subject: next } : { body: next };

    startTransition(async () => {
      const result = await updateStep(step.id, patch);
      if (!result.ok) {
        notify(
          `${result.error} The ${field} on step ${label} was not saved.`,
          "danger",
        );
      }
    });
  };

  const changeStatus = (
    sequence: SequenceRow,
    status: SequenceRow["status"],
  ) => {
    startTransition(async () => {
      const result = await setSequenceStatus(sequence.id, status);
      if (!result.ok) {
        notify(`${result.error} ${sequence.name} was not changed.`, "danger");
        return;
      }
      notify(
        status === "running"
          ? `${sequence.name} is running.`
          : `${sequence.name} is paused. Nothing further sends until you start it again.`,
      );
      router.refresh();
    });
  };

  const selectedSteps = selected
    ? (stepsBySequence.get(selected.id) ?? [])
    : [];

  const selectedMailboxes = selected
    ? links
        .filter((l) => l.sequence_id === selected.id)
        .map((l) => mailboxById.get(l.mailbox_id))
        .filter((m): m is MailboxRow => Boolean(m))
    : [];

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      <header className="shrink-0 border-b border-rule px-6 py-5">
        <p className="legend text-ink-3">Pillar 3 / multichannel outbound</p>
        <h1 className="page-title mt-2 text-ink">Sequences</h1>

        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="legend text-ink-3">{label}</dt>
              <dd className="display text-[21px] leading-none">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {!selected ? (
        <div className="p-6">
          <EmptyState
            title="No sequences yet"
            body="A sequence is the copy a signal fires. Build one and the Dream 100 signals on the previous screen stop being a reading exercise."
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="Sequences"
            className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-rule bg-sheet"
          >
            {sequences.map((seq) => {
              const status = STATUS[seq.status];
              const active = seq.id === selected.id;
              return (
                <button
                  key={seq.id}
                  onClick={() => setSelectedId(seq.id)}
                  aria-current={active ? "true" : undefined}
                  className={`flex flex-col gap-2 border-b border-rule px-4 py-3 text-left ${
                    active ? "bg-well" : "hover:bg-well"
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">
                        {seq.name}
                      </span>
                      <span className="record-id mt-1 block text-ink-3">
                        {seq.ref}
                      </span>
                    </span>
                    <StatusChip tone={status.tone}>{status.word}</StatusChip>
                  </span>
                  <span className="meta text-ink-2">
                    {seq.enrolled} enrolled, {seq.replied} replied
                  </span>
                </button>
              );
            })}
          </nav>

          <section
            aria-label={selected.name}
            className="flex min-w-0 flex-1 flex-col overflow-y-auto"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-rule px-6 py-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[13px] font-medium">{selected.name}</h2>
                  <span className="record-id text-ink-3">{selected.ref}</span>
                  <StatusChip tone={STATUS[selected.status].tone}>
                    {STATUS[selected.status].word}
                  </StatusChip>
                </div>

                <p className="mt-2 max-w-[62ch] text-[12px] text-ink-2">
                  {selected.signal_trigger
                    ? TRIGGER[selected.signal_trigger]
                    : "Runs manually. Nothing sends until you enrol people yourself."}
                </p>

                <p className="meta mt-2 text-ink-3">
                  {selectedMailboxes.length === 0
                    ? "No mailbox attached yet"
                    : `Sends from ${selectedMailboxes.map((m) => m.address).join(", ")}`}
                </p>
              </div>

              {selected.status === "running" ? (
                <Button
                  disabled={pending}
                  onClick={() => changeStatus(selected, "paused")}
                >
                  <Pause size={13} strokeWidth={2} />
                  Pause sequence
                </Button>
              ) : (
                <Button
                  variant="primary"
                  disabled={pending}
                  onClick={() => changeStatus(selected, "running")}
                >
                  <Play size={13} strokeWidth={2} />
                  Start sequence
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-5 px-6 py-5">
              {selectedSteps.map((step, index) => {
                const channel = CHANNEL[step.channel];
                const Icon = channel.icon;
                return (
                  <article
                    key={step.id}
                    className="rounded-card border border-rule bg-sheet p-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="legend text-ink-3">Step {index + 1}</span>
                      <StatusChip tone="off">
                        <Icon size={13} strokeWidth={2.25} />
                        {channel.word}
                      </StatusChip>
                      <span className="meta text-ink-2">
                        Day {step.day_offset}
                      </span>
                    </div>

                    <div className="mt-3.5 flex flex-col gap-3">
                      {step.channel === "email" ? (
                        <label className="flex flex-col gap-2">
                          <span className="legend text-ink-2">Subject</span>
                          <Input
                            value={valueOf(step, "subject")}
                            onChange={(e) =>
                              edit(step.id, { subject: e.target.value })
                            }
                            onBlur={() => save(step, "subject", index + 1)}
                            placeholder="Write the subject line"
                            aria-label={`Step ${index + 1} subject`}
                          />
                        </label>
                      ) : null}

                      <label className="flex flex-col gap-2">
                        <span className="legend text-ink-2">Body</span>
                        <Textarea
                          rows={5}
                          value={valueOf(step, "body")}
                          onChange={(e) =>
                            edit(step.id, { body: e.target.value })
                          }
                          onBlur={() => save(step, "body", index + 1)}
                          placeholder="Write the message"
                          aria-label={`Step ${index + 1} body`}
                        />
                      </label>
                    </div>
                  </article>
                );
              })}

              {selectedSteps.length === 0 ? (
                <p className="rounded-control border border-dashed border-rule px-3 py-6 text-center text-[12px] text-ink-3">
                  No steps in this sequence yet
                </p>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
