"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Drawer } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { saveBDMemory } from "@/lib/actions";
import { agent } from "@/config/brand";
import type {
  BDAgentMemoryRow,
  BDMemoryKind,
  BDMemoryScope,
} from "@/lib/supabase/types";

// PLS-113, rebuilt to the frame in PLS-185. "Tell Reyhan something".
//
// The frame's order is the argument: the freeform box comes FIRST, because
// the fastest way to hand over context is to paste the thing you already
// have. The structured gaps come second, as rows rather than chips, and each
// one says what it costs to leave open: "Without this he cannot tell you
// when you are underpricing" is a reason to answer, "Your fee model" is just
// a label.
//
// A gap disappears once it is filled. Showing "Add your fee model" to
// somebody who added their fee model last week is how a product teaches
// people to ignore it. The client list arrives synced from the workspace's
// own book, because a fact the product already holds is never asked for.

type Gap = {
  kind: BDMemoryKind;
  /** The question, asked exactly as the row shows it. */
  question: string;
  /** What stays broken while this gap is open. */
  consequence: string;
  /** Defaulted title, so a recruiter only has to write the answer. */
  title: string;
  scope: BDMemoryScope;
};

const GAPS: Gap[] = [
  {
    kind: "offer",
    question: "What do you charge, and how do you structure it?",
    consequence: `Without this ${agent.pronoun} cannot tell you when you are underpricing`,
    title: "Fee model",
    scope: "agency",
  },
  {
    kind: "positioning",
    question: "Which placement are you proudest of, and why did you win it?",
    consequence: `Becomes the proof point in every approach ${agent.pronoun} drafts`,
    title: "Proof point",
    scope: "agency",
  },
  {
    kind: "capacity",
    question: "How many hours a week can you actually give to BD?",
    consequence: `${agent.name} plans against your real week, not an ideal one`,
    title: "BD capacity",
    scope: "personal",
  },
  {
    kind: "ideal_client",
    question: "Which kind of client do you do your best work for?",
    consequence: `Without this ${agent.possessive} targeting is generic`,
    title: "Ideal client",
    scope: "agency",
  },
  {
    kind: "territory",
    question: "Which sectors and geographies are actually yours?",
    consequence: "Keeps the research on your patch, not the whole market",
    title: "Territory",
    scope: "agency",
  },
];

export function TellMaraDrawer({
  open,
  onClose,
  memories,
  canManageAgency,
  meId,
  clientCount,
}: {
  open: boolean;
  onClose: () => void;
  memories: BDAgentMemoryRow[];
  canManageAgency: boolean;
  meId: string;
  /** Companies marked as clients, for the synced do-not-pitch row. */
  clientCount: number;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<Gap | null>(null);
  const [body, setBody] = useState("");
  const [freeform, setFreeform] = useState("");

  // A gap is filled when a memory of that kind exists that this recruiter can
  // see: an agency fact counts for everyone, a personal one only for its
  // author.
  const visible = memories.filter(
    (m) => m.scope === "agency" || m.user_id === meId,
  );
  const filled = new Set(visible.map((m) => m.kind));
  const openGaps = GAPS.filter((gap) => !filled.has(gap.kind));
  const answeredGaps = GAPS.filter((gap) => filled.has(gap.kind));

  const close = () => {
    setChosen(null);
    setBody("");
    setFreeform("");
    onClose();
  };

  const saveMemory = (input: {
    scope: BDMemoryScope;
    kind: BDMemoryKind;
    title: string;
    body: string;
    id?: string;
  }) => {
    // An owner-only fact from a member would be refused by the action anyway.
    // Filing it as personal keeps what they wrote rather than throwing an
    // error at them for a permission they did not ask about.
    const scope: BDMemoryScope =
      input.scope === "agency" && !canManageAgency ? "personal" : input.scope;

    startTransition(async () => {
      const result = await saveBDMemory({ ...input, scope });
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify(`${agent.name} has it.`);
      close();
      router.refresh();
    });
  };

  const saveFreeform = () => {
    const text = freeform.trim();
    if (!text) return;
    // The first line is the closest true thing to a title. No model call: an
    // unmetered extraction here would break the claim-before-paid-call law
    // for a convenience.
    const firstLine = text.split(/\r?\n/)[0] ?? "";
    const title =
      firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
    saveMemory({
      scope: "personal",
      kind: "note",
      title: title || "In your own words",
      body: text,
    });
  };

  // Editing an answered gap starts from what was written, not a blank box.
  const editGap = (gap: Gap) => {
    const existing = visible.find((m) => m.kind === gap.kind);
    setBody(existing?.body ?? "");
    setChosen(gap);
  };

  return (
    <Drawer open={open} onClose={close} label={`Tell ${agent.name} something`}>
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-medium leading-[1.45] text-mara-ink">
            Tell {agent.name} something
          </p>
          <p className="text-[12px] leading-[1.5] text-mara-ink-2">
            The more {agent.pronoun} knows, the more specific {agent.possessive}{" "}
            advice gets. None of this is required.
          </p>
        </div>

        {!chosen ? (
          <>
            {/* Freeform first, per the frame. */}
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-medium leading-[1.45] text-mara-ink">
                Tell it in your own words
              </p>
              <textarea
                value={freeform}
                onChange={(event) => setFreeform(event.target.value)}
                rows={4}
                placeholder="Paste a client email, a fee agreement, a job spec, a win or a loss. Or just type what changed."
                className="w-full resize-none rounded-card border border-mara-rule bg-mara-sheet px-3 py-2.5 text-[13px] leading-[1.5] text-mara-ink outline-none placeholder:text-mara-ink-3 focus:border-mara-violet"
              />
              {freeform.trim().length > 0 ? (
                <button
                  onClick={saveFreeform}
                  disabled={pending}
                  className="settle self-start rounded-control bg-mara-violet px-3 py-1.5 text-[12px] font-medium leading-[1.45] text-white hover:brightness-110 disabled:opacity-60"
                >
                  {pending ? "Saving" : "Save it"}
                </button>
              ) : null}
            </div>

            <div className="flex flex-col border-t border-mara-rule pt-3.5">
              <div className="flex items-center justify-between pb-1">
                <p className="text-[13px] font-medium leading-[1.45] text-mara-ink">
                  What {agent.pronoun} is missing
                </p>
                <p className="meta text-mara-ink-3">{openGaps.length} OPEN</p>
              </div>

              {openGaps.length === 0 ? (
                <p className="py-2.5 text-[12px] leading-[1.5] text-mara-ink-2">
                  Nothing. {agent.name} has everything {agent.pronoun} asks
                  for.
                </p>
              ) : (
                openGaps.map((gap) => (
                  <div
                    key={gap.kind}
                    className="flex items-start gap-2.5 border-t border-mara-rule py-2.5 first:border-t-0"
                  >
                    <span
                      aria-hidden
                      className="mt-[5px] size-[7px] shrink-0 rounded-full bg-mara-warn"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] leading-[1.45] text-mara-ink">
                        {gap.question}
                      </span>
                      <span className="block text-[11px] leading-[1.45] text-mara-ink-3">
                        {gap.consequence}
                      </span>
                    </span>
                    <button
                      onClick={() => setChosen(gap)}
                      className="settle shrink-0 rounded-control border border-mara-violet-edge bg-mara-violet-soft px-3 py-1 text-[11px] font-medium leading-[1.45] text-mara-violet-deep hover:brightness-95"
                    >
                      Answer
                    </button>
                  </div>
                ))
              )}

              {/* Synced, never asked for. Green because it is a filled state,
                  and the word "Synced" says why no question is being put. */}
              {clientCount > 0 ? (
                <div className="flex items-start gap-2.5 border-t border-mara-rule py-2.5">
                  <span
                    aria-hidden
                    className="mt-[5px] size-[7px] shrink-0 rounded-full bg-mara-good"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-[1.45] text-mara-ink">
                      Who is already a client, so {agent.pronoun} never pitches
                      them?
                    </span>
                    <span className="block text-[11px] leading-[1.45] text-mara-ink-3">
                      Synced from your client list, {clientCount}{" "}
                      {clientCount === 1 ? "company" : "companies"}
                    </span>
                  </span>
                  <button
                    onClick={() => {
                      close();
                      router.push("/companies");
                    }}
                    className="settle shrink-0 rounded-control border border-mara-rule bg-mara-sheet px-3 py-1 text-[11px] leading-[1.45] text-mara-ink-2 hover:border-mara-violet hover:text-mara-violet"
                  >
                    Edit
                  </button>
                </div>
              ) : null}

              {answeredGaps.map((gap) => (
                <div
                  key={gap.kind}
                  className="flex items-start gap-2.5 border-t border-mara-rule py-2.5"
                >
                  <span
                    aria-hidden
                    className="mt-[5px] size-[7px] shrink-0 rounded-full bg-mara-good"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-[1.45] text-mara-ink">
                      {gap.question}
                    </span>
                    <span className="block text-[11px] leading-[1.45] text-mara-ink-3">
                      Answered. {agent.name} uses it on every answer.
                    </span>
                  </span>
                  <button
                    onClick={() => editGap(gap)}
                    className="settle shrink-0 rounded-control border border-mara-rule bg-mara-sheet px-3 py-1 text-[11px] leading-[1.45] text-mara-ink-2 hover:border-mara-violet hover:text-mara-violet"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2.5">
            <p className="text-[13px] leading-[1.5] text-mara-ink">
              {chosen.question}
            </p>
            {chosen.scope === "agency" && !canManageAgency ? (
              <p className="text-[11px] leading-[1.45] text-mara-ink-3">
                Saved as your personal coaching. Only an owner or admin can set
                agency strategy.
              </p>
            ) : null}
            <textarea
              autoFocus
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={6}
              className="w-full resize-none rounded-card border border-mara-rule bg-mara-sheet px-3 py-2.5 text-[13px] leading-[1.5] text-mara-ink outline-none focus:border-mara-violet"
              placeholder="In your own words."
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const existing = visible.find(
                    (m) => m.kind === chosen.kind,
                  );
                  saveMemory({
                    scope: chosen.scope,
                    kind: chosen.kind,
                    title: chosen.title,
                    body,
                    // Revising replaces the fact rather than stacking a
                    // second copy of the same kind under it.
                    id: existing?.id,
                  });
                }}
                disabled={pending || body.trim().length === 0}
                className="settle rounded-control bg-mara-violet px-3 py-1.5 text-[12px] font-medium leading-[1.45] text-white hover:brightness-110 disabled:opacity-60"
              >
                {pending ? "Saving" : "Save"}
              </button>
              <button
                onClick={() => {
                  setChosen(null);
                  setBody("");
                }}
                className="settle rounded-control border border-mara-rule bg-mara-sheet px-3 py-1.5 text-[12px] leading-[1.45] text-mara-ink-2 hover:border-mara-violet hover:text-mara-violet"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
