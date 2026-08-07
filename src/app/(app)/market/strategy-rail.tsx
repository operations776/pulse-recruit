"use client";

import { Building2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AgentStatus, type AgentState } from "@/components/ai/agent-status";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteBDMemory } from "@/lib/actions";
import type { BDAgentMemoryRow, BDMemoryScope } from "@/lib/supabase/types";
import { MemoryDialog } from "./memory-dialog";

// PLS-98. The strategist's working brief.
//
// Every line here is something a person typed and can take back. That is the
// contract: no hidden profile, no inferred preferences, nothing the recruiter
// cannot see and delete.
//
// PLS-110 splits it into three switched panels rather than one long stack, and
// gives the column a live header.
//
// Pillars is the agency's strategy, Context is this recruiter's own coaching,
// and Read is what the last run produced. That split is not cosmetic: it is
// the same boundary the RLS policies enforce, agency records being
// owner-or-admin and personal records being gated on `user_id = auth.uid()`,
// so the two things a recruiter can do least interchangeably are no longer
// interleaved in one list.
//
// Pillars deliberately does NOT mean the five RecruiterGTM pillars. The module
// rail 264px to the left already names those, and a second column repeating
// them is exactly the dead-column defect PLS-99 removed.

export type RailPanel = "pillars" | "context" | "read";

const PANELS: { key: RailPanel; label: string }[] = [
  { key: "pillars", label: "Pillars" },
  { key: "context", label: "Context" },
  { key: "read", label: "Read" },
];

const KIND_LABEL: Record<string, string> = {
  positioning: "Positioning",
  ideal_client: "Ideal client",
  buyer: "Buyer",
  territory: "Territory",
  offer: "Offer",
  qualification: "Qualification",
  preference: "Preference",
  feedback: "Your feedback",
};

export function StrategyRail({
  memories,
  canManageAgency,
  meId,
  meter,
  currentRead,
  history,
  agentState,
  agentDetail,
}: {
  memories: BDAgentMemoryRow[];
  canManageAgency: boolean;
  meId: string;
  meter: React.ReactNode;
  /**
   * What the last run produced: the recommendation and the evidence under it.
   * Built by the workspace, which owns the parsed briefing, and rendered here
   * as the Read panel.
   */
  currentRead: React.ReactNode;
  /** The conversation history panel, under whichever panel is open. */
  history: React.ReactNode;
  /** Ready, Thinking, or Unavailable. Driven by the live run in the panel. */
  agentState: AgentState;
  /** The phase in words while a run is in flight. */
  agentDetail?: string | null;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState<BDMemoryScope | null>(null);
  const [editing, setEditing] = useState<BDAgentMemoryRow | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [panel, setPanel] = useState<RailPanel>("pillars");

  const agency = memories.filter((memory) => memory.scope === "agency");
  const personal = memories.filter((memory) => memory.scope === "personal");

  // A member without organisation rights lands their additions in their own
  // layer wherever they press Add, because the other one would not save.
  const addScope: BDMemoryScope =
    panel === "context" || !canManageAgency ? "personal" : "agency";

  const remove = (memory: BDAgentMemoryRow) => {
    setConfirming(null);
    startTransition(async () => {
      const result = await deleteBDMemory(memory.id);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify(`The strategist has forgotten: ${memory.title}`);
      router.refresh();
    });
  };

  const canEdit = (memory: BDAgentMemoryRow) =>
    memory.scope === "agency" ? canManageAgency : memory.user_id === meId;

  const list = (rows: BDAgentMemoryRow[], label: string, Icon: typeof Building2) => (
    <section className="border-t border-rule">
      <p className="legend flex items-center gap-1.5 px-4 py-2 text-ink-3">
        <Icon size={16} strokeWidth={1.5} className="size-3.5" aria-hidden />
        {label}
      </p>
      <ul>
        {rows.map((memory) => (
          <li
            key={memory.id}
            className="settle -mt-px border-t border-rule px-4 py-2.5 first:mt-0 hover:bg-paper"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-[1.4]">
                  {memory.title}
                </p>
                <p className="meta mt-0.5 text-ink-3">
                  {KIND_LABEL[memory.kind] ?? memory.kind}
                  {memory.source === "feedback" ? ", from an answer" : ""}
                </p>
              </div>

              {canEdit(memory) ? (
                <span className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => setEditing(memory)}
                    aria-label={`Edit ${memory.title}`}
                    className="flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-well hover:text-ink"
                  >
                    <Pencil size={16} strokeWidth={1.5} className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirming(memory.id)}
                    aria-label={`Delete ${memory.title}`}
                    className="flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-well hover:text-red"
                  >
                    <Trash2 size={16} strokeWidth={1.5} className="size-3.5" />
                  </button>
                </span>
              ) : null}
            </div>

            <p className="mt-1 line-clamp-3 text-[12px] leading-[1.5] text-ink-2">
              {memory.body}
            </p>

            {confirming === memory.id ? (
              <span className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-ink-2">Forget this?</span>
                <Button
                  variant="danger"
                  disabled={pending}
                  onClick={() => remove(memory)}
                >
                  Yes, forget it
                </Button>
                <Button onClick={() => setConfirming(null)}>Keep</Button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );

  // An intake, not a decorative blank. This is the highest-value thing a new
  // user can do on this screen, so it asks for it directly rather than
  // reporting that a list is empty.
  const empty = (title: string, body: string, action: string | null) => (
    <section className="border-t border-rule px-4 py-4">
      <p className="text-[13px] font-medium">{title}</p>
      <p className="mt-1.5 text-[12px] leading-[1.5] text-ink-2">{body}</p>
      {action ? (
        <span className="mt-3 inline-flex">
          <Button variant="primary" onClick={() => setAdding(addScope)}>
            <Plus size={16} strokeWidth={2} />
            {action}
          </Button>
        </span>
      ) : null}
    </section>
  );

  const pillars =
    agency.length > 0
      ? list(agency, "Agency strategy", Building2)
      : canManageAgency
        ? empty(
            "Tell the strategist who you are",
            "It researches the market either way. Knowing your niche, your buyer, your patch and what makes you different is what turns a list of companies into advice worth acting on.",
            "Add your first",
          )
        : empty(
            "No agency strategy yet",
            "An owner or an admin sets what the whole workspace sells and to whom. Anything the strategist should know about how you personally work goes in Context.",
            null,
          );

  const context =
    personal.length > 0
      ? list(personal, "Your coaching", UserRound)
      : empty(
          "Nothing from you yet",
          "Mark an answer useful or off target and the reason lands here. You can also add how you want to be advised, and only you will ever see it.",
          "Add coaching",
        );

  return (
    // Not a second rail. The module rail 264px to the left already names the
    // pillar, so a column repeating "BD Strategist" beside it was two rails
    // saying one thing with a dead column between them. This is the working
    // brief, and it says what it holds rather than what screen you are on.
    <aside className="flex w-[264px] shrink-0 flex-col overflow-hidden border-r border-rule bg-sheet">
      <div className="flex items-center gap-2 px-4 py-3">
        {/* The header was a static "Working brief" label. The panel toggles
            below now name what the column holds, so the header is free to
            carry the one thing that changes: whether the strategist is
            working. */}
        <span className="min-w-0 flex-1">
          <AgentStatus state={agentState} detail={agentDetail} />
        </span>
        <Button
          onClick={() => setAdding(addScope)}
          aria-label={
            addScope === "agency" ? "Add agency strategy" : "Add your coaching"
          }
        >
          <Plus size={16} strokeWidth={2} />
          Add
        </Button>
      </div>

      <div className="border-t border-rule px-4 py-3">{meter}</div>

      {/* DESIGN.md section 9: a toggle group is an inset well holding caps.
          The selected cap is violet, not the teal section 9 still specifies:
          PLS-108 found every segmented control in the product painting its
          selected cap teal, and teal means on or running. A selected tab is
          not a running thing, and on this screen teal is spoken for by the
          Thinking indicator directly above. */}
      <div className="border-t border-rule px-4 py-2.5">
        <div className="well flex gap-1 rounded-control p-1">
          {PANELS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPanel(key)}
              aria-pressed={panel === key}
              className={`legend flex h-7 flex-1 items-center justify-center rounded-control px-2 ${
                panel === key
                  ? "cap bg-violet text-on-violet [--edge:var(--color-violet-edge)]"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {panel === "pillars" ? pillars : null}
        {panel === "context" ? context : null}
        {panel === "read" ? currentRead : null}

        {/* History is not one of the three. It is thread navigation rather
            than something the strategist knows, and it arrived with PLS-105
            after this design was drawn, so it keeps its own place under
            whichever panel is open. */}
        {history}
      </div>

      {adding ? (
        <MemoryDialog
          open
          onClose={() => setAdding(null)}
          editing={null}
          canManageAgency={canManageAgency}
          defaultScope={adding}
          onSaved={() => router.refresh()}
        />
      ) : null}

      {editing ? (
        <MemoryDialog
          // Keyed so switching rows rebuilds the form state rather than
          // carrying the previous record's text into the next edit.
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          editing={editing}
          canManageAgency={canManageAgency}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </aside>
  );
}
