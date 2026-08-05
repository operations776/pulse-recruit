"use client";

import { Building2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteBDMemory } from "@/lib/actions";
import type { BDAgentMemoryRow } from "@/lib/supabase/types";
import { MemoryDialog } from "./memory-dialog";

// PLS-98. The strategist's working brief.
//
// Every line here is something a person typed and can take back. That is the
// contract: no hidden profile, no inferred preferences, nothing the recruiter
// cannot see and delete.

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
}: {
  memories: BDAgentMemoryRow[];
  canManageAgency: boolean;
  meId: string;
  meter: React.ReactNode;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BDAgentMemoryRow | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const agency = memories.filter((memory) => memory.scope === "agency");
  const personal = memories.filter((memory) => memory.scope === "personal");

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

  const group = (rows: BDAgentMemoryRow[], label: string, Icon: typeof Building2) => {
    if (rows.length === 0) return null;
    return (
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
  };

  return (
    <aside className="flex w-[264px] shrink-0 flex-col overflow-hidden border-r border-rule bg-sheet">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="legend flex-1 text-ink-2">BD Strategist</span>
        <Button onClick={() => setAdding(true)} aria-label="Add context">
          <Plus size={16} strokeWidth={2} />
          Context
        </Button>
      </div>

      <div className="border-t border-rule px-4 py-3">{meter}</div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {memories.length === 0 ? (
          // An intake, not a decorative blank. This is the highest-value thing
          // a new user can do on this screen, so it asks for it directly.
          <section className="border-t border-rule px-4 py-4">
            <p className="text-[13px] font-medium">
              Tell the strategist who you are
            </p>
            <p className="mt-1.5 text-[12px] leading-[1.5] text-ink-2">
              It researches the market either way. Knowing your niche, your
              buyer, your patch and what makes you different is what turns a
              list of companies into advice worth acting on.
            </p>
            <span className="mt-3 inline-flex">
              <Button variant="primary" onClick={() => setAdding(true)}>
                <Plus size={16} strokeWidth={2} />
                Add your first
              </Button>
            </span>
          </section>
        ) : (
          <>
            {group(agency, "Agency strategy", Building2)}
            {group(personal, "Your coaching", UserRound)}
          </>
        )}
      </div>

      {adding ? (
        <MemoryDialog
          open
          onClose={() => setAdding(false)}
          editing={null}
          canManageAgency={canManageAgency}
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
