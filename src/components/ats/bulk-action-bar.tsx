"use client";

import { Archive, MoveRight, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import type { Stage } from "@/lib/types";

export function BulkActionBar({ stages }: { stages: Stage[] }) {
  const { selection, clearSelection, bulkMove, bulkArchive, bulkDelete } =
    useStore();
  const { notify } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const count = selection.length;
  if (count === 0) return null;

  // Honest counts, per ARCHITECTURE.md law 9. Never "Done" with no number.
  const noun = count === 1 ? "candidate" : "candidates";

  return (
    <>
      <div className="pointer-events-none sticky bottom-6 z-20 flex justify-center px-6">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-forest-900 py-2 pl-4 pr-2 text-white shadow-pop">
          <span className="data-literal text-[12px] text-white/70">
            {count} selected
          </span>
          <span className="mx-2 h-4 w-px bg-white/15" />

          <button
            onClick={() => setMoveOpen(true)}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium hover:bg-white/10"
          >
            <MoveRight size={14} strokeWidth={1.75} />
            Move
          </button>

          <button
            onClick={() => {
              bulkArchive();
              notify(`Archived ${count} ${noun}`);
            }}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium hover:bg-white/10"
          >
            <Archive size={14} strokeWidth={1.75} />
            Archive
          </button>

          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-hue-coral hover:bg-white/10"
          >
            <Trash2 size={14} strokeWidth={1.75} />
            Delete
          </button>

          <span className="mx-2 h-4 w-px bg-white/15" />
          <button
            onClick={clearSelection}
            aria-label="Clear selection"
            className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X size={14} strokeWidth={2} />
          </button>
          <span className="data-literal pr-2 text-[11px] text-white/50">
            esc to deselect
          </span>
        </div>
      </div>

      <Dialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={`Move ${count} ${noun}`}
        description="Pick the stage to move the selection into."
      >
        <div className="flex flex-col gap-1.5">
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => {
                bulkMove(stage.id);
                setMoveOpen(false);
                notify(`Moved ${count} ${noun} to ${stage.name}`);
              }}
              className="flex h-10 items-center rounded-lg border border-line px-3 text-left text-[13px] font-medium hover:border-emerald-600 hover:bg-emerald-50"
            >
              {stage.name}
            </button>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${count} ${noun}?`}
        description="This removes their notes and activity history too. It cannot be undone."
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                bulkDelete();
                setConfirmDelete(false);
                notify(`Deleted ${count} ${noun}`, "danger");
              }}
            >
              Delete {count} {noun}
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink-600">
          Archiving keeps the record and hides it from the board. Deleting does
          not.
        </p>
      </Dialog>
    </>
  );
}
