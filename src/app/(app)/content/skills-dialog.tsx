"use client";

import { Dialog } from "@/components/ui/overlay";
import { SKILLS } from "@/config/content-skills";
import type { ContentSkill, PostRow } from "@/lib/supabase/types";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * The shapes a post can take, as a popup.
 *
 * This was a route at /content/skills, which put a reference card behind a
 * navigation step and split one job across two rooms: you had to leave the
 * calendar to remember what a shape asks for. It is reference material, so it
 * belongs on top of the work rather than instead of it.
 */
export function SkillsDialog({
  open,
  onClose,
  posts,
}: {
  open: boolean;
  onClose: () => void;
  posts: PostRow[];
}) {
  // Count once, read many. A per-skill filter inside the map would walk the
  // whole list five times for no reason.
  const written = new Map<ContentSkill, number>();
  for (const post of posts) {
    written.set(post.skill, (written.get(post.skill) ?? 0) + 1);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="wide"
      title="Skills"
      description="Every post is written through one of these. Pick the shape first, then fill it."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {SKILLS.map((skill) => {
          const Icon = skill.icon;
          return (
            <article
              key={skill.key}
              className="flex flex-col rounded-card border border-rule bg-sheet p-4"
            >
              <div className="flex items-start gap-3">
                <span className="well flex size-9 shrink-0 items-center justify-center rounded-control">
                  <Icon size={16} strokeWidth={1.5} className="text-ink-2" />
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-medium leading-[1.5]">
                    {skill.name}
                  </h3>
                  <p className="mt-1 text-[12px] leading-[1.5] text-ink-2">
                    {skill.blurb}
                  </p>
                </div>

                <span className="meta shrink-0 text-ink-3">
                  {pad2(written.get(skill.key) ?? 0)}
                </span>
              </div>

              <p className="well mt-3 whitespace-pre-line rounded-control p-3 text-[12px] leading-[1.5] text-ink-2">
                {skill.prompt}
              </p>
            </article>
          );
        })}
      </div>
    </Dialog>
  );
}
