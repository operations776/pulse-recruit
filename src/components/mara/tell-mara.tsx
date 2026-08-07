"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Drawer } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { saveBDMemory } from "@/lib/actions";
import type {
  BDAgentMemoryRow,
  BDMemoryKind,
  BDMemoryScope,
} from "@/lib/supabase/types";

// PLS-113. "Tell Mara something".
//
// The Figma shows four prompts, and they are not decoration: they are the four
// things Mara asks for and cannot infer from any table. A recruiter faced with
// an empty box types nothing, so the drawer opens with the specific gaps and
// each one preloads the question.
//
// A gap disappears once it is filled. Showing "Add your fee model" to somebody
// who added their fee model last week is how a product teaches people to
// ignore it.

type Gap = {
  kind: BDMemoryKind;
  /** The chip label. */
  label: string;
  /** The question shown above the box once this gap is chosen. */
  question: string;
  /** Defaulted title, so a recruiter only has to write the answer. */
  title: string;
  scope: BDMemoryScope;
};

const GAPS: Gap[] = [
  {
    kind: "offer",
    label: "Your fee model",
    question: "What do you charge, and how is it structured?",
    title: "Fee model",
    scope: "agency",
  },
  {
    kind: "ideal_client",
    label: "Who you are best for",
    question:
      "Which kind of client do you do your best work for, and why them?",
    title: "Ideal client",
    scope: "agency",
  },
  {
    kind: "territory",
    label: "Your patch",
    question: "Which sectors and geographies are actually yours?",
    title: "Territory",
    scope: "agency",
  },
  {
    kind: "preference",
    label: "How you like to work",
    question:
      "Anything Mara should know about how you want to be advised? Blunt, cautious, evidence first?",
    title: "How I work",
    scope: "personal",
  },
];

export function TellMaraDrawer({
  open,
  onClose,
  memories,
  canManageAgency,
  meId,
}: {
  open: boolean;
  onClose: () => void;
  memories: BDAgentMemoryRow[];
  canManageAgency: boolean;
  meId: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<Gap | null>(null);
  const [body, setBody] = useState("");

  // A gap is filled when a memory of that kind exists that this recruiter can
  // see: an agency fact counts for everyone, a personal one only for its
  // author.
  const filled = new Set(
    memories
      .filter((m) => m.scope === "agency" || m.user_id === meId)
      .map((m) => m.kind),
  );
  const openGaps = GAPS.filter((gap) => !filled.has(gap.kind));

  const close = () => {
    setChosen(null);
    setBody("");
    onClose();
  };

  const save = () => {
    if (!chosen) return;
    // An owner-only fact from a member would be refused by the action anyway.
    // Filing it as personal coaching keeps what they wrote rather than
    // throwing an error at them for a permission they did not ask about.
    const scope: BDMemoryScope =
      chosen.scope === "agency" && !canManageAgency ? "personal" : chosen.scope;

    startTransition(async () => {
      const result = await saveBDMemory({
        scope,
        kind: chosen.kind,
        title: chosen.title,
        body,
      });
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify("Mara has it.");
      close();
      router.refresh();
    });
  };

  return (
    <Drawer open={open} onClose={close} label="Tell Mara something">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-medium leading-[1.45] text-mara-ink">
            Tell Mara something
          </p>
          <p className="text-[12px] leading-[1.5] text-mara-ink-2">
            She uses this on every answer. The more she knows about your
            business, the less generic her advice is.
          </p>
        </div>

        {!chosen ? (
          <>
            {openGaps.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="meta text-mara-ink-3">SHE IS MISSING</p>
                <div className="flex flex-wrap gap-1.5">
                  {openGaps.map((gap) => (
                    <button
                      key={gap.kind}
                      onClick={() => setChosen(gap)}
                      className="settle rounded-[20px] border border-mara-amber-edge bg-mara-amber-bg px-2.5 py-1 text-[11px] leading-[1.45] text-mara-amber-ink hover:brightness-95"
                    >
                      {gap.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[12px] leading-[1.5] text-mara-ink-2">
                She has everything she asks for. Add anything else below.
              </p>
            )}

            <div className="flex flex-col gap-2 border-t border-mara-rule pt-3">
              <p className="meta text-mara-ink-3">OR SOMETHING ELSE</p>
              <div className="flex flex-wrap gap-1.5">
                {GAPS.filter((gap) => filled.has(gap.kind)).map((gap) => (
                  <button
                    key={gap.kind}
                    onClick={() => setChosen(gap)}
                    className="settle rounded-[20px] border border-mara-rule bg-mara-sheet px-2.5 py-1 text-[11px] leading-[1.45] text-mara-ink-2 hover:border-mara-violet hover:text-mara-violet"
                  >
                    {gap.label}
                  </button>
                ))}
              </div>
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
              className="w-full resize-none rounded-shell border border-mara-rule bg-mara-sheet px-3 py-2.5 text-[13px] leading-[1.5] text-mara-ink outline-none focus:border-mara-violet"
              placeholder="In your own words."
            />
            <div className="flex items-center gap-2">
              <button
                onClick={save}
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
