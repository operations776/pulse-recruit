"use client";

import { ExternalLink, MapPin, Send, X } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MatchScore } from "@/components/ui/match-score";
import { Badge, CopyField } from "@/components/ui/misc";
import { Drawer } from "@/components/ui/overlay";
import { Activity, freshnessFor } from "@/components/ui/pulse-dot";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { NOW } from "@/lib/mock/seed";
import { useStore } from "@/lib/store";
import { formatDate, relativeTime } from "@/lib/time";
import type { Candidate, Stage } from "@/lib/types";

type Tab = "profile" | "notes" | "activity";

export function CandidateDrawer({
  candidate,
  stages,
  onClose,
}: {
  candidate: Candidate | null;
  stages: Stage[];
  onClose: () => void;
}) {
  const { notesFor, activityFor, addNote, moveCandidate, memberById } = useStore();
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>("profile");
  const [draft, setDraft] = useState("");

  if (!candidate) return null;

  const stage = stages.find((s) => s.id === candidate.stageId);
  const notes = notesFor(candidate.id);
  const events = activityFor(candidate.id);

  const submitNote = () => {
    const body = draft.trim();
    if (!body) return;
    // Closing nothing and revalidating nothing: the drawer stays mounted and the
    // store updates in place. Revalidating a route under an open layer remounts
    // it and drops the draft, which is the bug class CLAUDE.md forbids.
    addNote(candidate.id, body);
    setDraft("");
    notify("Note added");
  };

  return (
    <Drawer open onClose={onClose} label={`${candidate.name} details`}>
      <div className="flex items-start justify-between gap-3 border-b border-rule p-5">
        <div className="flex min-w-0 gap-3">
          <Avatar name={candidate.name} src={candidate.avatarUrl} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate display text-[18px] font-semibold leading-6">
              {candidate.name}
            </h2>
            <p className="truncate text-[15px] text-ink-2">
              {candidate.title}
              {candidate.companyName ? ` at ${candidate.companyName}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {stage ? <Badge hue="accent">{stage.name}</Badge> : null}
              {candidate.match > 0 ? <MatchScore value={candidate.match} /> : null}
              <Activity
                freshness={freshnessFor(new Date(candidate.lastActivityAt), NOW)}
                label={relativeTime(candidate.lastActivityAt)}
              />
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-control p-1 text-ink-3 hover:bg-paper hover:text-ink"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-rule px-5">
        {(["profile", "notes", "activity"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 pb-2.5 pt-2 text-[15px] capitalize ${
              tab === t
                ? "border-vermilion font-semibold text-vermilion-hover"
                : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {t}
            {t === "notes" && notes.length > 0 ? (
              <span className="meta ml-1.5 text-[15px] text-ink-3">
                {notes.length}
              </span>
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
                  <dt className="w-20 shrink-0 text-[15px] text-ink-3">Email</dt>
                  <dd className="min-w-0">
                    <CopyField
                      value={candidate.email}
                      label="email"
                      href={`mailto:${candidate.email}`}
                    />
                  </dd>
                </div>
                <div className="flex items-baseline gap-3">
                  <dt className="w-20 shrink-0 text-[15px] text-ink-3">Phone</dt>
                  <dd className="min-w-0">
                    <CopyField value={candidate.phone} label="phone" />
                  </dd>
                </div>
                <div className="flex items-baseline gap-3">
                  <dt className="w-20 shrink-0 text-[15px] text-ink-3">LinkedIn</dt>
                  <dd className="min-w-0">
                    {candidate.linkedinUrl ? (
                      <a
                        href={candidate.linkedinUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-[15px] text-vermilion-hover hover:underline"
                      >
                        <ExternalLink size={13} strokeWidth={1.75} />
                        Open profile
                      </a>
                    ) : (
                      <span className="text-[15px] text-ink-3">Not provided</span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="legend mb-2.5 text-ink-2">Details</h3>
              <dl className="flex flex-col gap-2.5 text-[15px]">
                {[
                  ["Location", candidate.location, MapPin],
                  ["Salary", candidate.salary, null],
                  ["Source", candidate.source, null],
                  ["Owner", memberById(candidate.ownerId)?.name ?? "Unassigned", null],
                  ["Added", formatDate(candidate.createdAt), null],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex items-baseline gap-3">
                    <dt className="w-20 shrink-0 text-[15px] text-ink-3">
                      {label as string}
                    </dt>
                    <dd className="text-ink">
                      {(value as string) || "Not provided"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h3 className="legend mb-2.5 text-ink-2">Move to stage</h3>
              <div className="flex flex-wrap gap-1.5">
                {stages.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (s.id === candidate.stageId) return;
                      moveCandidate(candidate.id, s.id);
                      notify(`${candidate.name} moved to ${s.name}`);
                    }}
                    className={`h-8 rounded-full border px-3 text-[15px] font-medium ${
                      s.id === candidate.stageId
                        ? "border-vermilion bg-well text-vermilion-hover"
                        : "border-rule hover:border-vermilion hover:bg-well"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "notes" ? (
          <div className="flex flex-col gap-4">
            {notes.length === 0 ? (
              <p className="text-[15px] text-ink-2">
                No notes yet. Add the first one below.
              </p>
            ) : (
              notes.map((n) => (
                <article key={n.id} className="flex gap-2.5">
                  <Avatar name={memberById(n.authorId)?.name ?? "Unknown"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2">
                      <span className="text-[15px] font-semibold">
                        {memberById(n.authorId)?.name}
                      </span>
                      <span className="meta text-[15px] text-ink-3">
                        {relativeTime(n.createdAt)}
                      </span>
                    </p>
                    <p className="mt-1 text-[15px] leading-5 text-ink-2">
                      {n.body}
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : null}

        {tab === "activity" ? (
          <ol className="flex flex-col gap-3.5">
            {events.map((e) => (
              <li key={e.id} className="flex gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-rule" />
                <div className="min-w-0">
                  <p className="text-[15px]">{e.summary}</p>
                  <p className="meta text-[15px] text-ink-3">
                    {memberById(e.actorId)?.name} · {relativeTime(e.createdAt)}
                  </p>
                </div>
              </li>
            ))}
            {events.length === 0 ? (
              <p className="text-[15px] text-ink-2">Nothing recorded yet.</p>
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
            <Button variant="primary" onClick={submitNote} disabled={!draft.trim()}>
              <Send size={14} strokeWidth={1.75} />
              Add note
            </Button>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
