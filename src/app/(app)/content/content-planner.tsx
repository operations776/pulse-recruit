"use client";

import {
  ChevronLeft,
  ChevronRight,
  Plus,
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
  retryPost,
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
import { ContentRail, needsYou, type ContentFilter } from "./content-rail";
import { WeekView } from "./week-view";
import { WaitingOnYou, waitingRows } from "./waiting-on-you";
import { GenerateDialog } from "./generate-dialog";
import { PostDialog } from "./post-dialog";
import { SkillsDialog } from "./skills-dialog";
import { StatusBoard } from "./content-board";


// Dropping onto a day means nine in the morning in the workspace zone. It is a
// default, not a rule: the drawer sets any time.
const DEFAULT_TIME = "09:00";

// `week` is the Figma's default and now this screen's: it answers what is
// going out this week, which is the question a planner is opened for. Month
// and board stay for the other two questions.
type View = "week" | "calendar" | "board";

export function ContentPlanner({
  filter,
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
  pendingLessons,
  canPublish,
}: {
  filter: ContentFilter;
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
  pendingLessons: number;
  /** A connected LinkedIn profile, so a scheduled post actually goes out. */
  canPublish: boolean;
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
    const mine =
      author === "all"
        ? posts
        : posts.filter((p) => p.author_id === (author === "mine" ? meId : author));

    // The rail's queues are a filter over the same list rather than separate
    // screens, so nothing moves between them and the view toggle keeps working
    // inside each one.
    if (filter === "needs-you") return needsYou(mine);
    if (filter === "ideas") return mine.filter((p) => p.status === "idea");
    if (filter === "published") {
      return mine.filter((p) => p.status === "published");
    }
    return mine;
  }, [posts, author, meId, filter]);

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

  // The stat strip that used to sit here is gone with the Figma header. Its
  // ideas and published counts moved into the rail, and "needs you" replaces
  // the overdue and failed pair with the queue a person actually clears.
  // Pending lessons lost their surface in the move and want one back: that is
  // noted in TICKETS.md rather than left as a silently dropped number.

  /**
   * The Figma's title and its one line of state.
   *
   * The title names the slice you are looking at, not the module: the rail two
   * columns to the left already says CONTENT, and repeating it is the defect
   * PLS-99 was filed for. The sentence under it is the only state worth reading
   * before the strip, and it counts real rows rather than describing the
   * feature.
   */
  const headline = useMemo(() => {
    const waiting = needsYou(visible).length;
    const going = visible.filter(
      (p) => p.status === "scheduled" || p.status === "publishing",
    ).length;

    // The title names what is on screen. A filter wins over the view, because
    // "Ideas" is a smaller and more surprising thing to be looking at than
    // whichever layout is drawing it.
    const title =
      filter === "needs-you"
        ? "Needs you"
        : filter === "ideas"
          ? "Ideas"
          : filter === "published"
            ? "Published"
            : view === "board"
              ? "Pipeline"
              : view === "calendar"
                ? monthLabel(month)
                : "This week";

    if (filter !== "all") {
      return { title, sub: `${visible.length} in this view` };
    }

    // The board and the month grid are not weeks, so the week's sentence would
    // be answering a question neither of them asked. The board says how it
    // works, because moving a post between columns is the one interaction on
    // this screen that is not obvious from looking at it.
    if (view === "board") {
      return {
        title,
        sub: "Open a post to move it forward.",
      };
    }
    if (view === "calendar") {
      const dated = visible.filter((p) => p.scheduled_for).length;
      const live = visible.filter((p) => p.status === "published").length;
      return { title, sub: `${dated} scheduled. ${live} live.` };
    }

    // An empty week is a sentence, not a zero. "0 going out." reads as a
    // broken counter; saying nothing is scheduled says the same fact and also
    // says what to do about it.
    if (going === 0 && waiting === 0) {
      return { title, sub: "Nothing scheduled. Add a post to any day." };
    }

    const parts: string[] = [];
    if (going > 0) {
      parts.push(going === 1 ? "One going out" : `${going} going out`);
    }
    if (waiting > 0) {
      parts.push(
        waiting === 1 ? "one is waiting on you" : `${waiting} are waiting on you`,
      );
    }
    // Capitalised here rather than in the strings, so the second clause reads
    // as a continuation whether or not the first one is present.
    const sub = parts.join(". ");
    return { title, sub: `${sub.charAt(0).toUpperCase()}${sub.slice(1)}.` };
  }, [visible, filter, view, month]);

  // What is blocked, computed once. The week strip says what is going out;
  // this says what will not move until somebody touches it.
  const waiting = useMemo(
    () => waitingRows(visible, shapes, timezone),
    [visible, shapes, timezone],
  );

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
          ? canPublish
            ? `${post?.ref ?? "Post"} goes out ${day} at ${time}.`
            : `${post?.ref ?? "Post"} is set for ${day} at ${time}. Connect a LinkedIn profile in Settings, Channels and it will go out on its own.`
          : `${post?.ref ?? "Post"} went back to the backlog.`,
      );
      router.refresh();
    });
  };

  /**
   * Put a failed post back in the queue.
   *
   * A failure is terminal by design, so this is the deliberate second attempt.
   * It goes out at the next sweep rather than at the old time, which has passed.
   */
  const retry = (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    setOpenId(null);
    startTransition(async () => {
      const result = await retryPost(postId);
      if (!result.ok) {
        notify(result.error, "danger");
        return;
      }
      notify(`${post?.ref ?? "The post"} is queued to go out again shortly.`);
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
          : `${post.ref} marked published. This records a post you put up yourself, it does not send anything.`,
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
    <div className="flex min-w-0 flex-1 overflow-hidden bg-paper">
      <ContentRail
        filter={filter}
        posts={posts}
        skillCount={shapes.length}
        hasPersona={hasPersona}
        pendingLessons={pendingLessons}
        onOpenSkills={() => setSkillsOpen(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/*
        The Figma's header. The title names what you are looking at rather than
        the module, because the rail two columns left already says CONTENT, and
        the sentence under it is the one line of state worth reading before the
        strip: how much is going out, and how much is waiting on you.
      */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule px-6 py-3">
        <div className="min-w-0 shrink-0">
          <h1 className="display text-[18px] leading-none">{headline.title}</h1>
          <p className="meta mt-1.5 text-ink-2">{headline.sub}</p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* DESIGN.md section 9: a toggle group is an inset well holding
              caps. Violet rather than teal, per PLS-108: teal means on or
              running, and a selected tab is not a running thing. */}
          <div className="well flex gap-1 rounded-control p-1">
            {(
              [
                ["week", "Week"],
                ["calendar", "Month"],
                ["board", "Board"],
              ] as [View, string][]
            ).map(([key, label]) => (
              <Link
                key={key}
                href={href({ view: key })}
                aria-current={view === key ? "true" : undefined}
                className={`legend flex h-7 items-center rounded-control px-3 ${
                  view === key
                    ? "cap bg-violet text-on-violet [--edge:var(--color-violet-edge)]"
                    : "text-ink-2 hover:text-ink"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

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
            {/* The Calendar / Board toggle used to sit here. It moved into the
                header as Week / Month / Board when the Figma header landed, and
                leaving it here gave the screen two controls doing one job,
                disagreeing about what the views are even called. Caught by the
                first screenshot, which is the only thing that would have. */}

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

          {view === "week" ? (
            <div className="p-3">
              <WeekView
                posts={visible}
                shapes={shapes}
                todayKey={today}
                tz={timezone}
                onOpen={(post) => setOpenId(post.id)}
                onAddOn={(day) => {
                  setSeedDay(day);
                  setAddOpen(true);
                }}
              />
            </div>
          ) : view === "calendar" ? (
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
              onAdd={() => {
                setSeedDay("");
                setAddOpen(true);
              }}
            />
          )}
        </div>

        {/* Its own shell, below the planner's. DESIGN.md section 7: gaps exist
            between shells and never inside one, so this is a sibling rather
            than a section nested in the calendar's sheet. */}
        <WaitingOnYou
          rows={waiting}
          shapes={shapes}
          onOpen={(post) => setOpenId(post.id)}
          onAct={(post, kind) => {
            // Retry is the one action that is a write from here. Review and
            // Schedule both open the post, because both need a human to read
            // the thing before committing it to a date.
            if (kind === "retry") retry(post.id);
            else setOpenId(post.id);
          }}
        />
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
        shapes={shapes}
        configured={generationConfigured}
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
          onRetry={retry}
          canPublish={canPublish}
          onError={(message) => notify(message, "danger")}
        />
      ) : null}
    </main>
    </div>
  );
}
