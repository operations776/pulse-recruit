"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Dialog, Drawer } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { SKILLS, SKILL_BY_KEY } from "@/config/content-skills";
import { createPost, setPostStatus } from "@/lib/actions";
import type { ContentSkill, PostRow, PostStatus } from "@/lib/supabase/types";
import { formatDate, relativeTime } from "@/lib/time";

// The board reads left to right in the order a post actually travels.
const COLUMNS: { status: PostStatus; label: string }[] = [
  { status: "idea", label: "Idea" },
  { status: "drafted", label: "Drafted" },
  { status: "scheduled", label: "Scheduled" },
  { status: "published", label: "Published" },
];

// Pulse does not post to LinkedIn yet. The toast says so rather than implying a
// send happened, because a state change nobody understood is worse than none.
const MOVE_NOTE: Record<PostStatus, string> = {
  idea: "moved back to Idea. Anything you wrote in the body is kept.",
  drafted: "marked Drafted. Nothing leaves Pulse at this stage.",
  scheduled:
    "marked Scheduled for tomorrow. Pulse does not post for you yet, so this records the plan.",
  published:
    "marked Published. You still post it yourself, this records that you did.",
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export function ContentBoard({
  posts,
  now,
}: {
  posts: PostRow[];
  now: string;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  const [addOpen, setAddOpen] = useState(false);
  const [skill, setSkill] = useState<ContentSkill>(SKILLS[0].key);
  const [hook, setHook] = useState("");
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const clock = useMemo(() => new Date(now), [now]);

  const countOf = (status: PostStatus) =>
    posts.filter((p) => p.status === status).length;

  const open = posts.find((p) => p.id === openId) ?? null;

  const closeDialog = () => {
    setAddOpen(false);
    setSkill(SKILLS[0].key);
    setHook("");
    setError("");
  };

  const submit = () => {
    const line = hook.trim();
    if (!line) {
      setError("Write the hook first. It is the line the post lives or dies on.");
      return;
    }
    const chosen = skill;
    const name = SKILL_BY_KEY[chosen].name;

    // createPost revalidates this route. Close the dialog before the write so
    // the revalidate cannot land under an open layer and remount it.
    closeDialog();

    startTransition(async () => {
      const result = await createPost(chosen, line);
      if (!result.ok) {
        notify(`${result.error} The post was not added.`, "danger");
        return;
      }
      notify(`${name} added to Idea`);
      router.refresh();
    });
  };

  const move = (post: PostRow, status: PostStatus) => {
    // Same rule as the dialog: the drawer closes first, then the write lands.
    setOpenId(null);

    startTransition(async () => {
      const result = await setPostStatus(post.id, status);
      if (!result.ok) {
        notify(`${result.error} ${post.ref} did not move.`, "danger");
        return;
      }
      notify(`${post.ref} ${MOVE_NOTE[status]}`);
      router.refresh();
    });
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-paper">
      <header className="border-b border-rule px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="legend text-ink-3">Pillar 5 / content</p>
            <h1 className="display mt-2 text-[18px]">Content planner</h1>
            <p className="mt-2 max-w-[62ch] text-[12px] text-ink-2">
              Thirty posts a quarter is the target. Plan the week here instead of
              starting from zero every Monday.
            </p>
          </div>

          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus size={14} strokeWidth={2.25} />
            New post
          </Button>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
          {[
            ["Published", countOf("published")],
            ["Scheduled", countOf("scheduled")],
            ["Drafted", countOf("drafted")],
            ["Ideas", countOf("idea")],
          ].map(([label, value]) => (
            <div key={label as string} className="flex flex-col gap-1">
              <dt className="legend text-ink-3">{label as string}</dt>
              <dd className="display text-[21px] leading-none">
                {pad2(value as number)}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="p-5">
        <div className="overflow-hidden rounded-shell border border-rule bg-sheet">
          <div className="flex">
            {COLUMNS.map((col) => {
              const inColumn = posts.filter((p) => p.status === col.status);

              return (
                <section
                  key={col.status}
                  aria-label={col.label}
                  className="-ml-px flex min-w-0 flex-1 flex-col border-l border-rule first:ml-0 first:border-l-0"
                >
                  <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
                    <span className="legend flex-1 text-ink-2">{col.label}</span>
                    <span className="meta text-ink-2">
                      {pad2(inColumn.length)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 p-4">
                    {inColumn.map((post) => {
                      const def = SKILL_BY_KEY[post.skill];
                      return (
                        <button
                          key={post.id}
                          onClick={() => setOpenId(post.id)}
                          className="flex flex-col gap-2 rounded-card border border-rule bg-sheet p-3 text-left hover:bg-well"
                        >
                          <span className="legend text-ink-2">{def.name}</span>
                          <span className="line-clamp-3 text-[13px] font-medium leading-[1.5]">
                            {post.hook}
                          </span>
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="record-id text-ink-3">
                              {post.ref}
                            </span>
                            <span className="meta text-ink-3">
                              {relativeTime(post.created_at, clock)}
                            </span>
                          </span>
                        </button>
                      );
                    })}

                    {inColumn.length === 0 ? (
                      <p className="rounded-control border border-dashed border-rule px-3 py-6 text-center text-[12px] text-ink-3">
                        Nothing in {col.label.toLowerCase()} yet
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog
        open={addOpen}
        onClose={closeDialog}
        title="New post"
        description="Pick the shape first. The frame below is what you fill in."
        footer={
          <>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button variant="primary" onClick={submit} disabled={pending}>
              Add to board
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <Field label="Skill" hint={SKILL_BY_KEY[skill].blurb}>
            <Select
              value={skill}
              onChange={(e) => setSkill(e.target.value as ContentSkill)}
            >
              {SKILLS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <div>
            <p className="legend text-ink-2">The frame</p>
            <p className="well mt-2 whitespace-pre-line rounded-control p-3 text-[12px] leading-[1.5] text-ink-2">
              {SKILL_BY_KEY[skill].prompt}
            </p>
          </div>

          <Field
            label="Hook"
            hint="The first line, in your own words. Everything else follows it."
          >
            <Input
              value={hook}
              onChange={(e) => {
                setHook(e.target.value);
                if (error) setError("");
              }}
              placeholder="Six design roles went live in London this week."
              autoFocus
            />
          </Field>

          {error ? (
            <p role="alert" className="text-[12px] font-medium text-red">
              {error}
            </p>
          ) : null}
        </div>
      </Dialog>

      {open ? (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          label={`${SKILL_BY_KEY[open.skill].name} post`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-rule p-5">
            <div className="min-w-0">
              <p className="legend text-ink-2">
                {SKILL_BY_KEY[open.skill].name}
              </p>
              <h2 className="mt-2 text-[13px] font-medium leading-[1.5]">
                {open.hook}
              </h2>
              <p className="meta mt-2 text-ink-3">
                <span className="record-id">{open.ref}</span>
                {` added ${formatDate(open.created_at)}`}
              </p>
            </div>
            <button
              onClick={() => setOpenId(null)}
              aria-label="Close"
              className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-well hover:text-ink"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <section>
              <h3 className="legend mb-2.5 text-ink-2">The frame</h3>
              <p className="well whitespace-pre-line rounded-control p-3 text-[12px] leading-[1.5] text-ink-2">
                {SKILL_BY_KEY[open.skill].prompt}
              </p>
            </section>

            <section className="mt-5">
              <h3 className="legend mb-2.5 text-ink-2">The post</h3>
              {open.body ? (
                <p className="whitespace-pre-line text-[13px] leading-[1.5]">
                  {open.body}
                </p>
              ) : (
                <p className="text-[12px] text-ink-3">Not written yet</p>
              )}
            </section>
          </div>

          <div className="border-t border-rule p-4">
            <h3 className="legend mb-2.5 text-ink-2">Move to</h3>
            <div className="flex flex-wrap gap-2">
              {COLUMNS.filter((c) => c.status !== open.status).map((c) => (
                <Button
                  key={c.status}
                  variant="secondary"
                  disabled={pending}
                  onClick={() => move(open, c.status)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </div>
        </Drawer>
      ) : null}
    </main>
  );
}
