"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { SKILLS, SKILL_BY_KEY } from "@/config/content-skills";
import {
  createPost,
  deletePost,
  schedulePost,
  setPostStatus,
} from "@/lib/actions";
import type { ContentSkill, PostAsset, PostRow } from "@/lib/supabase/types";
import {
  dayKey,
  instantAt,
  monthLabel,
  shiftMonth,
  timeOfDay,
} from "@/lib/time";
import { Backlog } from "./backlog";
import { CalendarGrid } from "./calendar-grid";
import { PostDrawer } from "./post-drawer";
import { StatusBoard } from "./content-board";

const pad2 = (n: number) => String(n).padStart(2, "0");

// Dropping onto a day means nine in the morning in the workspace zone. It is a
// default, not a rule: the drawer sets any time.
const DEFAULT_TIME = "09:00";

type View = "calendar" | "board";

export function ContentPlanner({
  posts,
  assets,
  timezone,
  month,
  today,
  view,
}: {
  posts: PostRow[];
  assets: Record<string, PostAsset[]>;
  timezone: string;
  month: string;
  today: string;
  view: View;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  const [addOpen, setAddOpen] = useState(false);
  const [addSkill, setAddSkill] = useState<ContentSkill>(SKILLS[0].key);
  const [addHook, setAddHook] = useState("");
  const [addDay, setAddDay] = useState("");
  const [addError, setAddError] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);

  const open = posts.find((p) => p.id === openId) ?? null;

  // One pass over the posts, keyed by the day they fall on in the workspace
  // zone. Doing this per cell would walk the list forty two times.
  const byDay = useMemo(() => {
    const map = new Map<string, PostRow[]>();
    for (const post of posts) {
      if (!post.scheduled_for) continue;
      const key = dayKey(post.scheduled_for, timezone);
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        timeOfDay(a.scheduled_for!, timezone).localeCompare(
          timeOfDay(b.scheduled_for!, timezone),
        ),
      );
    }
    return map;
  }, [posts, timezone]);

  const backlog = useMemo(
    () => posts.filter((p) => !p.scheduled_for),
    [posts],
  );

  const counts = {
    published: posts.filter((p) => p.status === "published").length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    drafted: posts.filter((p) => p.status === "drafted").length,
    idea: posts.filter((p) => p.status === "idea").length,
  };

  const href = (next: { month?: string; view?: View }) =>
    `/content?month=${next.month ?? month}&view=${next.view ?? view}`;

  const closeAdd = () => {
    setAddOpen(false);
    setAddSkill(SKILLS[0].key);
    setAddHook("");
    setAddDay("");
    setAddError("");
  };

  const submitAdd = () => {
    const hook = addHook.trim();
    if (!hook) {
      setAddError("Write the hook first. It is the line the post lives on.");
      return;
    }
    const skill = addSkill;
    const day = addDay;
    const name = SKILL_BY_KEY[skill].name;

    // The dialog closes before the write, so the revalidate cannot land under
    // an open layer and remount it.
    closeAdd();

    startTransition(async () => {
      const created = await createPost(
        skill,
        hook,
        day ? instantAt(day, DEFAULT_TIME, timezone) : null,
      );
      if (!created.ok) {
        notify(`${created.error} The post was not added.`, "danger");
        return;
      }
      notify(
        day
          ? `${name} added and set for ${day} at ${DEFAULT_TIME}. Pulse does not post it for you yet, so this records the plan.`
          : `${name} added to the backlog.`,
      );
      router.refresh();
    });
  };

  const schedule = (postId: string, day: string, time = DEFAULT_TIME) => {
    const post = posts.find((p) => p.id === postId);
    setOpenId(null);
    setDraggingId(null);
    setDropDay(null);

    startTransition(async () => {
      const result = await schedulePost(
        postId,
        day ? instantAt(day, time, timezone) : null,
      );
      if (!result.ok) {
        notify(`${result.error} ${post?.ref ?? "The post"} did not move.`, "danger");
        return;
      }
      notify(
        day
          ? `${post?.ref ?? "Post"} is set for ${day} at ${time}. Pulse does not post it for you yet, so this records the plan.`
          : `${post?.ref ?? "Post"} went back to the backlog.`,
      );
      router.refresh();
    });
  };

  const togglePublished = (post: PostRow) => {
    setOpenId(null);
    startTransition(async () => {
      const result = await setPostStatus(
        post.id,
        post.status === "published" ? "drafted" : "published",
      );
      if (!result.ok) {
        notify(`${result.error} ${post.ref} did not change.`, "danger");
        return;
      }
      notify(
        post.status === "published"
          ? `${post.ref} is no longer marked published.`
          : `${post.ref} marked published. You still post it yourself, this records that you did.`,
      );
      router.refresh();
    });
  };

  const remove = (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    setOpenId(null);
    startTransition(async () => {
      const result = await deletePost(postId);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify(`${post?.ref ?? "The post"} and its media are deleted.`);
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
              Thirty posts a quarter is the target. Plan the week here instead
              of starting from zero every Monday.
            </p>
          </div>

          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus size={16} strokeWidth={2} />
            New post
          </Button>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
          {[
            ["Published", counts.published],
            ["Scheduled", counts.scheduled],
            ["Drafted", counts.drafted],
            ["Ideas", counts.idea],
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

      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* DESIGN.md section 9: a toggle group is an inset well holding caps,
              and the active cap is teal because teal means on. */}
          <div className="well flex gap-1 rounded-control p-1">
            {(
              [
                ["calendar", "Calendar"],
                ["board", "Board"],
              ] as [View, string][]
            ).map(([key, label]) => (
              <Link
                key={key}
                href={href({ view: key })}
                aria-current={view === key ? "true" : undefined}
                className={[
                  "legend flex h-7 items-center rounded-control px-3",
                  view === key
                    ? "cap bg-teal text-sheet [--edge:var(--color-teal-edge)]"
                    : "text-ink-2 hover:text-ink",
                ].join(" ")}
              >
                {label}
              </Link>
            ))}
          </div>

          {view === "calendar" ? (
            <div className="flex items-center gap-2">
              <Link
                href={href({ month: shiftMonth(month, -1) })}
                aria-label="Previous month"
                className="cap flex size-7 items-center justify-center rounded-control border border-ink text-ink hover:bg-well [--edge:var(--color-ink)]"
              >
                <ChevronLeft size={16} strokeWidth={1.5} />
              </Link>
              <span className="display min-w-[10rem] text-center text-[13px]">
                {monthLabel(month)}
              </span>
              <Link
                href={href({ month: shiftMonth(month, 1) })}
                aria-label="Next month"
                className="cap flex size-7 items-center justify-center rounded-control border border-ink text-ink hover:bg-well [--edge:var(--color-ink)]"
              >
                <ChevronRight size={16} strokeWidth={1.5} />
              </Link>
            </div>
          ) : null}
        </div>

        {view === "calendar" ? (
          <>
            <CalendarGrid
              month={month}
              today={today}
              timezone={timezone}
              byDay={byDay}
              assetCount={(id) => assets[id]?.length ?? 0}
              draggingId={draggingId}
              dropDay={dropDay}
              onOpen={(post) => setOpenId(post.id)}
              onAddOn={(day) => {
                setAddDay(day);
                setAddOpen(true);
              }}
              onDragStart={setDraggingId}
              onDragEnd={() => {
                setDraggingId(null);
                setDropDay(null);
              }}
              onDragOverDay={setDropDay}
              onDropOn={(day, postId) => {
                // Prefer the payload the drag carries; fall back to state for
                // any browser that hands back an empty dataTransfer.
                const id = postId || draggingId;
                if (id) schedule(id, day);
              }}
            />

            <Backlog
              posts={backlog}
              draggingId={draggingId}
              onOpen={(post) => setOpenId(post.id)}
              onSchedule={(postId, day) => schedule(postId, day)}
              onDragStart={setDraggingId}
              onDragEnd={() => {
                setDraggingId(null);
                setDropDay(null);
              }}
            />
          </>
        ) : (
          <StatusBoard
            posts={posts}
            timezone={timezone}
            onOpen={(post) => setOpenId(post.id)}
          />
        )}
      </div>

      <Dialog
        open={addOpen}
        onClose={closeAdd}
        title="New post"
        description="Pick the shape first. The frame below is what you fill in."
        footer={
          <>
            <Button onClick={closeAdd}>Cancel</Button>
            <Button variant="primary" onClick={submitAdd} disabled={pending}>
              Add
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <Field label="Skill" hint={SKILL_BY_KEY[addSkill].blurb}>
            <Select
              value={addSkill}
              onChange={(event) =>
                setAddSkill(event.target.value as ContentSkill)
              }
            >
              {SKILLS.map((skill) => (
                <option key={skill.key} value={skill.key}>
                  {skill.name}
                </option>
              ))}
            </Select>
          </Field>

          <div>
            <p className="legend text-ink-2">The frame</p>
            <p className="well mt-2 whitespace-pre-line rounded-control p-3 text-[12px] leading-[1.5] text-ink-2">
              {SKILL_BY_KEY[addSkill].prompt}
            </p>
          </div>

          <Field
            label="Hook"
            hint="The first line, in your own words. Everything else follows it."
          >
            <Input
              value={addHook}
              autoFocus
              onChange={(event) => {
                setAddHook(event.target.value);
                if (addError) setAddError("");
              }}
              placeholder="Six design roles went live in London this week."
            />
          </Field>

          <Field
            label="Date"
            hint="Leave it empty to park the idea in the backlog."
          >
            <Input
              type="date"
              value={addDay}
              onChange={(event) => setAddDay(event.target.value)}
              className="w-40"
            />
          </Field>

          {addError ? (
            <p role="alert" className="text-[12px] font-medium text-red">
              {addError}
            </p>
          ) : null}
        </div>
      </Dialog>

      {open ? (
        <PostDrawer
          key={open.id}
          post={open}
          assets={assets[open.id] ?? []}
          timezone={timezone}
          onClose={() => {
            setOpenId(null);
            // Media uploads deliberately skip revalidation while the drawer is
            // open, so the refresh happens here instead.
            router.refresh();
          }}
          onSchedule={schedule}
          onTogglePublished={togglePublished}
          onDelete={remove}
          onError={(message) => notify(message, "danger")}
        />
      ) : null}
    </main>
  );
}
