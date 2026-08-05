"use client";

import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SKILLS, SKILL_BY_KEY } from "@/config/content-skills";
import {
  createPost,
  createWrittenPost,
  deletePost,
  schedulePost,
  setPostStatus,
} from "@/lib/actions";
import type {
  ContentSkill,
  OrgMember,
  PostAsset,
  PostRow,
  Shape,
} from "@/lib/supabase/types";
import {
  dayKey,
  instantAt,
  monthLabel,
  shiftMonth,
  timeOfDay,
} from "@/lib/time";
import { Backlog } from "./backlog";
import { CalendarGrid } from "./calendar-grid";
import { GenerateDialog } from "./generate-dialog";
import { StatStrip, type Stat } from "./stat-strip";
import { PostDialog } from "./post-dialog";
import { SkillsDialog } from "./skills-dialog";
import { StatusBoard } from "./content-board";


// The Button primitive renders a real button and this control navigates, so it
// wears Button's classes on a Link. Same keycap edge, same radius.
const LINK_BUTTON =
  "cap inline-flex h-7 shrink-0 items-center justify-center gap-2 rounded-control border border-ink bg-transparent px-3 text-[12px] font-medium text-ink hover:bg-well [--edge:var(--color-ink)]";

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
  meId,
  members,
  shapes,
  hasPersona,
  generationConfigured,
  todayInstant,
  pendingLessons,
}: {
  posts: PostRow[];
  assets: Record<string, PostAsset[]>;
  timezone: string;
  month: string;
  today: string;
  view: View;
  meId: string;
  members: OrgMember[];
  shapes: Shape[];
  hasPersona: boolean;
  generationConfigured: boolean;
  /** Fixed on the server so the stat strip agrees across hydration. */
  todayInstant: string;
  pendingLessons: number;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  const [addOpen, setAddOpen] = useState(false);
  // The day a per-cell "+" was clicked on, so the composer opens dated.
  const [seedDay, setSeedDay] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);

  // Whose calendar you are looking at: yours, everyone's, or one teammate's.
  // Yours is the default, because this screen is each person planning their
  // own posts, not an approval queue.
  const [author, setAuthor] = useState<string>("mine");

  const open = posts.find((p) => p.id === openId) ?? null;

  const visible = useMemo(() => {
    if (author === "all") return posts;
    const target = author === "mine" ? meId : author;
    return posts.filter((p) => p.author_id === target);
  }, [posts, author, meId]);

  // One pass over the posts, keyed by the day they fall on in the workspace
  // zone. Doing this per cell would walk the list forty two times.
  const byDay = useMemo(() => {
    const map = new Map<string, PostRow[]>();
    for (const post of visible) {
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
  }, [visible, timezone]);

  const backlog = useMemo(
    () => visible.filter((p) => !p.scheduled_for),
    [visible],
  );

  /**
   * The stat strip. Deliberately not the four status counts it replaced:
   * "Drafted 01" answers a question nobody asks, while "nothing planned for
   * the next 7 days" is the one thing a content calendar exists to tell you.
   */
  const stats = useMemo((): Stat[] => {
    const now = new Date(todayInstant);
    const weekEnd = new Date(now.getTime() + 7 * 86_400_000);

    const dated = visible.filter((p) => p.scheduled_for);
    const upcoming = dated.filter((p) => {
      const at = new Date(p.scheduled_for!);
      return at >= now && at <= weekEnd && p.status !== "published";
    });
    const overdue = dated.filter(
      (p) => p.status === "scheduled" && new Date(p.scheduled_for!) < now,
    );

    return [
      { label: "next 7 days", value: upcoming.length },
      // Past its slot and still not marked published: the calendar is lying
      // about that post until someone acts on it.
      { label: "overdue", value: overdue.length, attention: true },
      { label: "ideas", value: visible.filter((p) => !p.scheduled_for).length },
      {
        label: "published",
        value: visible.filter((p) => p.status === "published").length,
      },
      { label: "lessons", value: pendingLessons, attention: true },
    ];
  }, [visible, todayInstant, pendingLessons]);

  const href = (next: { month?: string; view?: View }) =>
    `/content?month=${next.month ?? month}&view=${next.view ?? view}`;

  /**
   * Add the post the generate dialog produced.
   *
   * The dialog closes before the write, so the revalidate cannot land under an
   * open layer and remount it. That is the named bug class in CLAUDE.md and it
   * applies to this dialog exactly as it did to the last one.
   */
  const addWritten = (input: {
    shape: Shape;
    hook: string;
    body: string;
    day: string;
    generated: string | null;
  }) => {
    setAddOpen(false);

    startTransition(async () => {
      const created = await createWrittenPost({
        // A custom shape carries its id; a built-in is identified by the skill
        // column, which every existing reader already understands.
        skill: (input.shape.id ? SKILLS[0].key : input.shape.key) as ContentSkill,
        shapeId: input.shape.id,
        hook: input.hook,
        body: input.body,
        when: input.day ? instantAt(input.day, DEFAULT_TIME, timezone) : null,
        generated: input.generated,
      });
      if (!created.ok) {
        notify(`${created.error} The post was not added.`, "danger");
        return;
      }
      notify(
        input.day
          ? `${input.shape.name} added and set for ${input.day} at ${DEFAULT_TIME}. Pulse does not post it for you yet, so this records the plan.`
          : `${input.shape.name} added to the backlog.`,
      );
      router.refresh();
    });
  };

  // The backlog's always-mounted capture row. Same write as the dialog, no
  // layer to close first.
  const quickAdd = (skill: ContentSkill, hook: string, day: string) => {
    const name = SKILL_BY_KEY[skill].name;
    startTransition(async () => {
      const created = await createPost(
        skill,
        hook,
        day ? instantAt(day, DEFAULT_TIME, timezone) : null,
      );
      if (!created.ok) {
        notify(`${created.error} The idea was not added.`, "danger");
        return;
      }
      notify(
        day ? `${name} added and set for ${day}.` : `${name} parked in the backlog.`,
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
    // The shell does not scroll; the body does. Previously `main` scrolled as
    // one column, so 180px of header pushed the calendar down and the sixth
    // week sat below the fold. Same shape as /ops/tasks.
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-paper">
      {/*
        The header was an eyebrow that repeated the sidebar 208px to its left,
        a title, a two-sentence explainer nobody rereads, and four two-digit
        numbers spread across 40px gaps in a row that was a quarter full. It is
        now one 48px band: identity on the left, the work on the right.
      */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule px-6 py-3">
        <h1 className="display shrink-0 text-[18px]">Content</h1>

        <StatStrip stats={stats} />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* An unbuilt voice is the one thing that makes every draft
              generic, so it is stated here rather than discovered later. */}
          <Link
            href="/content/persona"
            className={
              hasPersona
                ? LINK_BUTTON
                : `${LINK_BUTTON} border-amber bg-amber-bg text-amber-text [--edge:var(--color-amber)]`
            }
          >
            <UserRound size={16} strokeWidth={1.5} />
            {hasPersona ? "Your voice" : "Build your voice"}
          </Link>
          <Button onClick={() => setSkillsOpen(true)}>
            <Sparkles size={16} strokeWidth={1.5} />
            Skills
          </Button>
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus size={16} strokeWidth={2} />
            New post
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {/*
          One shell, not three. The toolbar used to float naked above a
          calendar shell and a backlog shell with 20px of paper showing
          between them. DESIGN.md section 7: sections inside a shell meet on a
          1px rule with no gap, and gaps exist only between shells.
        */}
        <div className="overflow-hidden rounded-shell border border-rule bg-sheet">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule px-4 py-2">
            {/* DESIGN.md section 9: a toggle group is an inset well holding
                caps, and the active cap is teal because teal means on. */}
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

            {/* Whose posts. Chips rather than a select, because with a small
                team every option deserves to be one click, not two. */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                ["mine", "Mine"] as const,
                ["all", "Everyone"] as const,
                ...members
                  .filter((m) => m.user_id !== meId)
                  .map((m) => [m.user_id, m.display_name] as const),
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setAuthor(key)}
                  aria-pressed={author === key}
                  className={`legend flex h-7 items-center rounded-control px-2.5 ${
                    author === key
                      ? "bg-well text-ink"
                      : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {view === "calendar" ? (
              <div className="ml-auto flex items-center gap-2">
                <Link
                  href={href({ month: shiftMonth(month, -1) })}
                  aria-label="Previous month"
                  className="cap flex size-7 items-center justify-center rounded-control border border-ink text-ink hover:bg-well [--edge:var(--color-ink)]"
                >
                  <ChevronLeft size={16} strokeWidth={1.5} />
                </Link>
                {/* min-w-[10rem] reserved 160px for a string needing ~90px.
                    The label sizes to its content now. */}
                <span className="display text-center text-[13px]">
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
              // Clicking a date opens the composer already pointed at that
              // day, so the click is not thrown away.
              onAddOn={(day) => {
                setSeedDay(day);
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
              allPosts={visible}
              timezone={timezone}
              draggingId={draggingId}
              onOpen={(post) => setOpenId(post.id)}
              onSchedule={(postId, day) => schedule(postId, day)}
              onQuickAdd={quickAdd}
              onDragStart={setDraggingId}
              onDragEnd={() => {
                setDraggingId(null);
                setDropDay(null);
              }}
              adding={pending}
            />
          </>
          ) : (
            <StatusBoard
              posts={visible}
              timezone={timezone}
              onOpen={(post) => setOpenId(post.id)}
            />
          )}
        </div>
      </div>

      <GenerateDialog
        // Remount per opening, so a seeded date lands and last time's draft
        // never reappears in a fresh composer.
        key={`${addOpen}-${seedDay}`}
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setSeedDay("");
        }}
        seedDay={seedDay}
        shapes={shapes}
        hasPersona={hasPersona}
        configured={generationConfigured}
        onAdd={addWritten}
        adding={pending}
      />

      <SkillsDialog
        open={skillsOpen}
        onClose={() => setSkillsOpen(false)}
        posts={posts}
      />

      {open ? (
        <PostDialog
          key={open.id}
          post={open}
          assets={assets[open.id] ?? []}
          timezone={timezone}
          onClose={() => {
            setOpenId(null);
            // Media uploads deliberately skip revalidation while the layer is
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
