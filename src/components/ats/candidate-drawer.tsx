"use client";

import { ExternalLink, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { MatchScore } from "@/components/ui/match-score";
import { CopyField, StatusChip } from "@/components/ui/misc";
import { Drawer } from "@/components/ui/overlay";
import { Activity, freshnessFor } from "@/components/ui/pulse-dot";
import { useToast } from "@/components/ui/toast";
import { addNote, moveCandidate } from "@/lib/actions";
import { ownerLabel } from "@/lib/people";
import type {
  ActivityRow,
  CandidateRow,
  NoteRow,
  StageRow,
} from "@/lib/supabase/types";
import { formatDate, relativeTime } from "@/lib/time";

type Tab = "profile" | "notes" | "activity";

export function CandidateDrawer({
  candidate,
  stages,
  notes,
  activity,
  viewerId,
  onClose,
}: {
  candidate: CandidateRow | null;
  stages: StageRow[];
  notes: NoteRow[];
  activity: ActivityRow[];
  // Only the person holding the session can be named, so authorship is shown
  // relative to them rather than with an invented display name.
  viewerId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>("profile");
  const [draft, setDraft] = useState("");
  const [busy, startTransition] = useTransition();

  if (!candidate) return null;

  const now = new Date();
  const stage = stages.find((s) => s.id === candidate.stage_id);

  // The drawer never unmounts across a write. router.refresh re-renders the
  // page above it and the fresh notes arrive as props, so the open tab and the
  // scroll position survive. Closing the layer to revalidate is the bug class
  // CLAUDE.md forbids.
  const submitNote = () => {
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const result = await addNote(candidate.id, body);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      setDraft("");
      router.refresh();
      notify("Note added.");
    });
  };

  const move = (target: StageRow) => {
    if (target.id === candidate.stage_id) return;
    startTransition(async () => {
      const result = await moveCandidate(candidate.id, target.id);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      router.refresh();
      notify(`${candidate.name} moved to ${target.name}.`);
    });
  };

  return (
    <Drawer open onClose={onClose} label={`${candidate.name} details`}>
      <div className="flex items-start justify-between gap-3 border-b border-rule p-5">
        <div className="flex min-w-0 gap-3">
          <Avatar name={candidate.name} size="lg" />
          <div className="min-w-0">
            <h2 className="display truncate text-[18px]">{candidate.name}</h2>
            <p className="truncate text-[12px] text-ink-2">
              {candidate.title || "Title not recorded"}
              {candidate.company_name ? ` at ${candidate.company_name}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {stage ? <StatusChip tone="on">{stage.name}</StatusChip> : null}
              {candidate.match > 0 ? (
                <MatchScore value={candidate.match} />
              ) : null}
              <Activity
                freshness={freshnessFor(
                  new Date(candidate.last_activity_at),
                  now,
                )}
                label={relativeTime(candidate.last_activity_at, now)}
              />
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-well hover:text-ink"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-rule px-5">
        {(["profile", "notes", "activity"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`h-8 border-b-2 px-3 text-[12px] capitalize ${
              tab === t
                ? "border-ink font-medium text-ink"
                : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {t}
            {t === "notes" && notes.length > 0 ? (
              <span className="meta ml-1.5 text-ink-3">{notes.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab === "profile" ? (
          <div className="flex flex-col gap-5">
            <section>
              <h3 className="legend mb-2.5 text-ink-2">Contact</h3>
              <dl className="flex flex-col gap-2.5">
                <div className="flex items-baseline gap-3">
                  <dt className="w-20 shrink-0 text-[12px] text-ink-3">
                    Email
                  </dt>
                  <dd className="min-w-0">
                    <CopyField
                      value={candidate.email}
                      label="email"
                      href={`mailto:${candidate.email}`}
                    />
                  </dd>
                </div>
                <div className="flex items-baseline gap-3">
                  <dt className="w-20 shrink-0 text-[12px] text-ink-3">
                    Phone
                  </dt>
                  <dd className="min-w-0">
                    <CopyField value={candidate.phone} label="phone" />
                  </dd>
                </div>
                <div className="flex items-baseline gap-3">
                  <dt className="w-20 shrink-0 text-[12px] text-ink-3">
                    LinkedIn
                  </dt>
                  <dd className="min-w-0">
                    {candidate.linkedin_url ? (
                      <a
                        href={candidate.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-7 items-center gap-1.5 text-[12px] text-ink underline-offset-2 hover:underline"
                      >
                        <ExternalLink size={16} strokeWidth={1.5} />
                        Open profile
                      </a>
                    ) : (
                      <span className="text-[12px] text-ink-3">
                        Not provided
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="legend mb-2.5 text-ink-2">Details</h3>
              <dl className="flex flex-col gap-2.5 text-[12px]">
                {[
                  ["Location", candidate.location],
                  ["Salary", candidate.salary],
                  ["Source", candidate.source],
                  ["Owner", ownerLabel(candidate.owner_id, viewerId ?? null)],
                  ["Added", formatDate(candidate.created_at)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline gap-3">
                    <dt className="w-20 shrink-0 text-[12px] text-ink-3">
                      {label}
                    </dt>
                    <dd className="text-ink">{value || "Not provided"}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h3 className="legend mb-2.5 text-ink-2">Move to stage</h3>
              <div className="flex flex-wrap gap-1.5">
                {stages.map((s) => {
                  const current = s.id === candidate.stage_id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => move(s)}
                      disabled={busy || current}
                      aria-current={current ? "true" : undefined}
                      className={`h-8 rounded-control border px-3 text-[12px] font-medium disabled:opacity-100 ${
                        current
                          ? "border-ink bg-well text-ink"
                          : "border-rule hover:bg-well"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "notes" ? (
          <div className="flex flex-col gap-4">
            {notes.length === 0 ? (
              <p className="text-[12px] text-ink-2">
                No notes yet. Add the first one below.
              </p>
            ) : (
              notes.map((n) => {
                const author = ownerLabel(n.author_id, viewerId ?? null);
                return (
                  <article key={n.id} className="flex gap-2.5">
                    <Avatar name={author} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-2">
                        <span className="text-[12px] font-medium">
                          {author}
                        </span>
                        <span className="meta text-ink-3">
                          {relativeTime(n.created_at, now)}
                        </span>
                      </p>
                      <p className="mt-1 text-[12px] leading-[1.5] text-ink-2">
                        {n.body}
                      </p>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        ) : null}

        {tab === "activity" ? (
          <ol className="flex flex-col gap-3.5">
            {activity.map((e) => (
              <li key={e.id} className="flex gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-chip bg-rule" />
                <div className="min-w-0">
                  <p className="text-[12px]">{e.summary}</p>
                  <p className="meta text-ink-3">
                    {ownerLabel(e.actor_id, viewerId ?? null)} ·{" "}
                    {relativeTime(e.created_at, now)}
                  </p>
                </div>
              </li>
            ))}
            {activity.length === 0 ? (
              <p className="text-[12px] text-ink-2">Nothing recorded yet.</p>
            ) : null}
          </ol>
        ) : null}
      </div>

      {tab === "notes" ? (
        <div className="border-t border-rule p-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitNote();
            }}
            rows={3}
            placeholder="Add a note. Cmd plus Enter to save."
            aria-label="New note"
          />
          <div className="mt-2 flex justify-end">
            <Button
              variant="primary"
              onClick={submitNote}
              disabled={busy || !draft.trim()}
            >
              <Send size={16} strokeWidth={1.5} />
              Add note
            </Button>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
