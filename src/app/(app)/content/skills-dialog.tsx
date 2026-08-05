"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { deleteShape } from "@/lib/actions";
import type { PostRow, Shape } from "@/lib/supabase/types";
import { ShapeDialog } from "./shape-dialog";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * The shapes a post can take.
 *
 * This was a route at /content/skills, which put a reference card behind a
 * navigation step and split one job across two rooms: you had to leave the
 * calendar to remember what a shape asks for. It is reference material, so it
 * belongs on top of the work rather than instead of it.
 *
 * It is also where shapes are made now. The five built into the product cannot
 * be deleted, because an org that removed them would have nothing to write
 * through on a fresh install.
 */
export function SkillsDialog({
  open,
  onClose,
  posts,
  shapes,
  configured,
}: {
  open: boolean;
  onClose: () => void;
  posts: PostRow[];
  shapes: Shape[];
  configured: boolean;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Count once, read many. A per-shape filter inside the map would walk the
  // whole list once per shape for no reason.
  const written = new Map<string, number>();
  for (const post of posts) {
    const key = post.shape_id ?? post.skill;
    written.set(key, (written.get(key) ?? 0) + 1);
  }

  const remove = (shape: Shape) => {
    if (!shape.id) return;
    setConfirmId(null);
    startTransition(async () => {
      const result = await deleteShape(shape.id!);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify(
        `${shape.name} removed. Posts already written through it keep their words.`,
      );
      router.refresh();
    });
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        size="wide"
        title="Shapes"
        description="Every post is written through one of these. Pick the shape first, then fill it."
        headerRight={
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={16} strokeWidth={2} />
            New shape
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {shapes.map((shape) => {
            const count = written.get(shape.id ?? shape.key) ?? 0;
            const custom = shape.id !== null;

            return (
              <article
                key={shape.id ?? shape.key}
                className="flex flex-col rounded-card border border-rule bg-sheet p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[13px] font-medium leading-[1.5]">
                      {shape.name}
                    </h3>
                    {shape.blurb ? (
                      <p className="mt-1 text-[12px] leading-[1.5] text-ink-2">
                        {shape.blurb}
                      </p>
                    ) : null}
                  </div>

                  <span className="flex shrink-0 items-center gap-2">
                    <span className="meta text-ink-3">{pad2(count)}</span>
                    {custom ? (
                      confirmId === shape.id ? (
                        <span className="flex items-center gap-1.5">
                          <Button
                            variant="danger"
                            disabled={pending}
                            onClick={() => remove(shape)}
                          >
                            Remove
                          </Button>
                          <Button onClick={() => setConfirmId(null)}>
                            Keep
                          </Button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmId(shape.id)}
                          aria-label={`Remove ${shape.name}`}
                          className="flex size-7 items-center justify-center rounded-control text-ink-3 hover:bg-well hover:text-red"
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                        </button>
                      )
                    ) : null}
                  </span>
                </div>

                <p className="well mt-3 whitespace-pre-line rounded-control p-3 text-[12px] leading-[1.5] text-ink-2">
                  {shape.prompt}
                </p>
              </article>
            );
          })}
        </div>
      </Dialog>

      <ShapeDialog
        key={String(addOpen)}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        configured={configured}
      />
    </>
  );
}
