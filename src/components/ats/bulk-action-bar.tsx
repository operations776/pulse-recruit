"use client";

import { Archive, Download, MoveRight, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import {
  archiveCandidates,
  bulkMoveCandidates,
  deleteCandidates,
} from "@/lib/actions";
import type { StageRow } from "@/lib/supabase/types";

function noun(count: number) {
  return count === 1 ? "candidate" : "candidates";
}

// Props driven: the board owns the selection, this bar owns the confirmation
// layers and the write. Every toast quotes the count the server returned, never
// the count that was asked for, because RLS can quietly exclude a row.
export function BulkActionBar({
  ids,
  stages,
  onClear,
  onExport,
}: {
  ids: string[];
  stages: StageRow[];
  onClear: () => void;
  onExport: () => void;
}) {
  const { notify } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [busy, startTransition] = useTransition();

  const count = ids.length;
  if (count === 0) return null;

  const report = (verb: string, written: number, suffix = "") => {
    if (written === 0) {
      notify(
        `Nothing was ${verb}. Those records may already be gone, or they belong to another workspace.`,
        "danger",
      );
      return;
    }
    notify(`${written} ${noun(written)} ${verb}${suffix}.`);
  };

  const move = (stage: StageRow) => {
    startTransition(async () => {
      const result = await bulkMoveCandidates(ids, stage.id);
      setMoveOpen(false);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      report("moved", result.data, ` to ${stage.name}`);
      onClear();
    });
  };

  const archive = () => {
    startTransition(async () => {
      const result = await archiveCandidates(ids);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      report("archived", result.data);
      onClear();
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await deleteCandidates(ids);
      setConfirmDelete(false);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      report("deleted", result.data);
      onClear();
    });
  };

  return (
    <>
      <div className="pointer-events-none sticky bottom-6 z-20 flex justify-center px-6">
        <div className="floating-dark pointer-events-auto flex items-center gap-1 rounded-shell py-2 pl-4 pr-2 text-sheet">
          <span className="meta text-sheet">{count} selected</span>
          <span className="mx-2 h-4 w-px bg-sheet/20" />

          <button
            onClick={() => setMoveOpen(true)}
            disabled={busy}
            className="flex h-7 items-center gap-1.5 rounded-control px-2.5 text-[12px] font-medium hover:bg-sheet/10 disabled:opacity-40"
          >
            <MoveRight size={16} strokeWidth={1.5} />
            Move
          </button>

          <button
            onClick={archive}
            disabled={busy}
            className="flex h-7 items-center gap-1.5 rounded-control px-2.5 text-[12px] font-medium hover:bg-sheet/10 disabled:opacity-40"
          >
            <Archive size={16} strokeWidth={1.5} />
            Archive
          </button>

          <button
            onClick={onExport}
            disabled={busy}
            className="flex h-7 items-center gap-1.5 rounded-control px-2.5 text-[12px] font-medium hover:bg-sheet/10 disabled:opacity-40"
          >
            <Download size={16} strokeWidth={1.5} />
            Export CSV
          </button>

          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="flex h-7 items-center gap-1.5 rounded-control px-2.5 text-[12px] font-medium hover:bg-sheet/10 disabled:opacity-40"
          >
            <Trash2 size={16} strokeWidth={1.5} />
            Delete
          </button>

          <span className="mx-2 h-4 w-px bg-sheet/20" />
          <button
            onClick={onClear}
            aria-label="Clear selection"
            className="flex size-7 items-center justify-center rounded-control text-sheet hover:bg-sheet/10"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
          <span className="meta pr-2 text-sheet">esc to deselect</span>
        </div>
      </div>

      <Dialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title={`Move ${count} ${noun(count)}`}
        description="Pick the stage to move the selection into."
      >
        <div className="flex flex-col gap-1.5">
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => move(stage)}
              disabled={busy}
              className="flex h-8 items-center rounded-control border border-rule px-3 text-left text-[12px] font-medium hover:bg-well disabled:opacity-40"
            >
              {stage.name}
            </button>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${count} ${noun(count)}?`}
        description="This removes their notes and activity history too. It cannot be undone."
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              Delete {count} {noun(count)}
            </Button>
          </>
        }
      >
        <p className="text-[12px] text-ink-2">
          Archiving keeps the record and hides it from the board. Deleting does
          not.
        </p>
      </Dialog>
    </>
  );
}
