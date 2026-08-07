"use client";

import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { skillColour } from "@/config/content-skills";
import { setSkillPaused, updateShape } from "@/lib/actions";
import type {
  PostMetricsRow,
  PostRow,
  Shape,
} from "@/lib/supabase/types";
import { ShapeDialog } from "../shape-dialog";

// PLS-188. The Skills screen, from the frame.
//
// The list carries what each skill has actually done: posts written through
// it and the average views Unipile reported. An average over nothing prints
// as a dash rather than a zero, the same arithmetic honesty rule the
// performance strip follows. The toggle pauses a skill for the whole
// workspace: it keeps its history, it just stops being offered for new
// posts.
//
// The editor edits org-defined shapes in place. The five built-ins are
// product config with no row to update, so their definition shows read-only
// with the reason stated, which beats a Save button that cannot save.

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

export function SkillsScreen({
  posts,
  shapes,
  metricsByPost,
  pausedKeys,
  configured,
}: {
  posts: PostRow[];
  shapes: Shape[];
  metricsByPost: Record<string, PostMetricsRow>;
  pausedKeys: string[];
  configured: boolean;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [selectedKey, setSelectedKey] = useState<string | null>(
    shapes[0] ? (shapes[0].id ?? shapes[0].key) : null,
  );
  const [addOpen, setAddOpen] = useState(false);

  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [prompt, setPrompt] = useState("");

  const paused = useMemo(() => new Set(pausedKeys), [pausedKeys]);

  // Per-skill: posts written and average reported views. Computed once.
  const stats = useMemo(() => {
    const out = new Map<string, { posts: number; views: number[]; top: PostRow[] }>();
    for (const post of posts) {
      const key = post.shape_id ?? post.skill;
      const entry = out.get(key) ?? { posts: 0, views: [], top: [] };
      entry.posts += 1;
      const views = metricsByPost[post.id]?.impressions;
      if (post.status === "published" && typeof views === "number") {
        entry.views.push(views);
        entry.top.push(post);
      }
      out.set(key, entry);
    }
    for (const entry of out.values()) {
      entry.top.sort(
        (a, b) =>
          (metricsByPost[b.id]?.impressions ?? 0) -
          (metricsByPost[a.id]?.impressions ?? 0),
      );
    }
    return out;
  }, [posts, metricsByPost]);

  const selected =
    shapes.find((s) => (s.id ?? s.key) === selectedKey) ?? null;

  const pick = (shape: Shape) => {
    setSelectedKey(shape.id ?? shape.key);
    setName(shape.name);
    setBlurb(shape.blurb ?? "");
    setPrompt(shape.prompt);
  };

  const togglePause = (shape: Shape) => {
    const key = shape.id ?? shape.key;
    const next = !paused.has(key);
    startTransition(async () => {
      const result = await setSkillPaused(key, next);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify(
        next
          ? `${shape.name} paused. It keeps its history and stops being offered for new posts.`
          : `${shape.name} is back on.`,
      );
      router.refresh();
    });
  };

  const save = () => {
    if (!selected?.id) return;
    startTransition(async () => {
      const result = await updateShape(selected.id!, { name, blurb, prompt });
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify(`${name} saved. New drafts write through it immediately.`);
      router.refresh();
    });
  };

  const editing = selected && (name || blurb || prompt);
  const dirty =
    selected &&
    editing &&
    (name !== selected.name ||
      blurb !== (selected.blurb ?? "") ||
      prompt !== selected.prompt);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule px-6 py-3">
        <div className="min-w-0">
          <Link
            href="/content"
            className="meta mb-1 flex items-center gap-1 text-ink-3 hover:text-ink"
          >
            <ArrowLeft size={12} strokeWidth={2} aria-hidden />
            Planner
          </Link>
          <h1 className="page-title text-ink">Skills</h1>
          <p className="meta mt-1.5 text-ink-2">
            Each one is a kind of post it knows how to write. Edit any of them.
          </p>
        </div>
        <div className="ml-auto shrink-0">
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus size={16} strokeWidth={2} />
            New skill
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-5 overflow-y-auto p-5">
        {/* The list. */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {shapes.map((shape) => {
            const key = shape.id ?? shape.key;
            const stat = stats.get(key);
            const avg =
              stat && stat.views.length > 0
                ? stat.views.reduce((a, b) => a + b, 0) / stat.views.length
                : null;
            const isPaused = paused.has(key);
            const accent = skillColour(shape.key);
            const active = selectedKey === key;

            return (
              <div
                key={key}
                className={`raised flex items-center gap-3 rounded-card border bg-sheet px-3.5 py-3 ${
                  active ? "border-violet" : "border-rule"
                } ${isPaused ? "opacity-80" : ""}`}
              >
                <span
                  aria-hidden
                  className={`flex size-9 shrink-0 items-center justify-center rounded-card ${accent.tint}`}
                >
                  <span className={`size-2 rounded-full bg-current ${accent.text}`} />
                </span>

                <button
                  type="button"
                  onClick={() => pick(shape)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium leading-[1.45] text-ink">
                      {shape.name}
                    </span>
                    {isPaused ? (
                      <span className="meta rounded-chip border border-rule px-1.5 text-ink-3">
                        Paused
                      </span>
                    ) : null}
                  </span>
                  {shape.blurb ? (
                    <span className="block truncate text-[11px] leading-[1.45] text-ink-3">
                      {shape.blurb}
                    </span>
                  ) : null}
                </button>

                <span className="flex shrink-0 flex-col items-end">
                  <span className="meta font-medium text-ink">
                    {stat?.posts ?? 0}
                  </span>
                  <span className="meta text-[9px] uppercase text-ink-3">
                    posts
                  </span>
                </span>
                <span className="flex w-14 shrink-0 flex-col items-end">
                  <span
                    className={`meta font-medium ${
                      avg !== null && avg >= 5000 ? "text-teal-text" : "text-ink"
                    }`}
                  >
                    {avg !== null ? compact(avg) : "--"}
                  </span>
                  <span className="meta text-[9px] uppercase text-ink-3">
                    avg views
                  </span>
                </span>

                <button
                  type="button"
                  role="switch"
                  aria-checked={!isPaused}
                  aria-label={
                    isPaused ? `Resume ${shape.name}` : `Pause ${shape.name}`
                  }
                  disabled={pending}
                  onClick={() => togglePause(shape)}
                  className={`settle relative h-5 w-9 shrink-0 rounded-chip disabled:opacity-50 ${
                    isPaused ? "bg-well" : "bg-violet"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`settle absolute top-0.5 size-4 rounded-full bg-float shadow-elev-2 ${
                      isPaused ? "left-0.5" : "left-[18px]"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* The editor. */}
        {selected ? (
          <aside className="raised flex w-[340px] shrink-0 flex-col gap-3.5 self-start rounded-card border border-rule bg-sheet p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[15px] font-medium leading-[1.4] text-ink">
                {selected.name}
              </p>
              <span className="meta text-ink-3">
                {selected.id ? "Editing" : "Built in"}
              </span>
            </div>

            {selected.id ? (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="meta uppercase text-ink-3">Name</span>
                  <input
                    value={editing ? name : selected.name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => {
                      if (!editing) pick(selected);
                    }}
                    className="rounded-control border border-rule bg-sheet px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-violet"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="meta uppercase text-ink-3">
                    What this skill is for
                  </span>
                  <input
                    value={editing ? blurb : (selected.blurb ?? "")}
                    onChange={(e) => setBlurb(e.target.value)}
                    onFocus={() => {
                      if (!editing) pick(selected);
                    }}
                    className="rounded-control border border-rule bg-sheet px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-violet"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="meta uppercase text-ink-3">
                    How it should write it
                  </span>
                  <textarea
                    rows={7}
                    value={editing ? prompt : selected.prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onFocus={() => {
                      if (!editing) pick(selected);
                    }}
                    className="resize-none rounded-control border border-rule bg-sheet px-2.5 py-2 text-[12px] leading-[1.5] text-ink outline-none focus:border-violet"
                  />
                </label>
              </>
            ) : (
              <>
                {selected.blurb ? (
                  <div>
                    <p className="meta mb-1 uppercase text-ink-3">
                      What this skill is for
                    </p>
                    <p className="well rounded-control p-2.5 text-[12px] leading-[1.5] text-ink-2">
                      {selected.blurb}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="meta mb-1 uppercase text-ink-3">
                    How it writes it
                  </p>
                  <p className="well whitespace-pre-line rounded-control p-2.5 text-[12px] leading-[1.5] text-ink-2">
                    {selected.prompt}
                  </p>
                </div>
                <p className="text-[11px] leading-[1.5] text-ink-3">
                  A built-in skill&rsquo;s definition ships with Pulse, so it
                  reads rather than edits. Make a new skill to write your own
                  version.
                </p>
              </>
            )}

            {/* The posts it learns from: this skill's best real performers. */}
            {(() => {
              const top =
                stats.get(selected.id ?? selected.key)?.top.slice(0, 2) ?? [];
              if (top.length === 0) return null;
              return (
                <div>
                  <p className="meta mb-1 uppercase text-ink-3">
                    Its best posts
                  </p>
                  {top.map((post) => (
                    <p
                      key={post.id}
                      className="flex items-baseline justify-between gap-3 border-t border-rule py-1.5 text-[12px] leading-[1.45] first:border-t-0"
                    >
                      <span className="min-w-0 truncate text-ink">
                        {post.hook || "Untitled"}
                      </span>
                      <span className="meta shrink-0 text-ink-3">
                        {compact(
                          metricsByPost[post.id]?.impressions ?? 0,
                        )}{" "}
                        views
                      </span>
                    </p>
                  ))}
                </div>
              );
            })()}

            <div className="flex items-center gap-2 pt-1">
              {selected.id ? (
                <Button
                  variant="primary"
                  disabled={pending || !dirty}
                  onClick={save}
                >
                  {pending ? "Saving" : "Save skill"}
                </Button>
              ) : null}
              <Button
                disabled={!configured}
                onClick={() => router.push("/content?view=week")}
                title={
                  configured
                    ? "Open the planner and draft one through this skill"
                    : "Generation is not configured on this deployment"
                }
              >
                Write a test post
              </Button>
            </div>
          </aside>
        ) : null}
      </div>

      <ShapeDialog
        key={String(addOpen)}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        configured={configured}
      />
    </main>
  );
}
