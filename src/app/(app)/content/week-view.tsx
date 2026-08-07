"use client";

import { skillColour } from "@/config/content-skills";
import type { PostAsset, PostRow, Shape } from "@/lib/supabase/types";
import { shapeForPost } from "@/lib/shapes";
import { dayKey, timeOfDay } from "@/lib/time";

/**
 * The week strip, from the Figma planner.
 *
 * Seven columns, Monday first, each holding whatever is scheduled that day.
 * It answers the one question a calendar exists for and a month grid answers
 * badly: what is going out this week, and is anything waiting on me.
 *
 * Everything is read inside the org's timezone. A day is a property of an
 * instant read inside a zone, so a post lands on the same square whether the
 * server or the browser drew it.
 */

/** What the card says about itself. Colour plus word, never colour alone. */
function statusOf(post: PostRow): { word: string; dot: string; tone: string } {
  switch (post.status) {
    case "published":
      return { word: "Live", dot: "bg-teal", tone: "text-teal-text" };
    case "publishing":
      return { word: "Going out", dot: "bg-teal", tone: "text-teal-text" };
    case "scheduled":
      return { word: "Scheduled", dot: "bg-violet", tone: "text-ink-2" };
    case "needs_review":
      return { word: "Review", dot: "bg-amber", tone: "text-amber-text" };
    case "needs_attention":
      return { word: "Needs attention", dot: "bg-amber", tone: "text-amber-text" };
    case "failed":
      return { word: "Did not send", dot: "bg-red", tone: "text-red" };
    default:
      return { word: "Draft", dot: "bg-ink-3", tone: "text-ink-2" };
  }
}

/** Monday-first week containing `todayKey`, as seven day keys. */
export function weekOf(todayKey: string): string[] {
  const [y, m, d] = todayKey.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  // getUTCDay puts Sunday at 0, so rotate by 6 to make Monday column zero.
  const back = (base.getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(base);
    day.setUTCDate(day.getUTCDate() - back + i);
    return day.toISOString().slice(0, 10);
  });
}

const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekView({
  posts,
  shapes,
  assets = {},
  todayKey,
  tz,
  onOpen,
  onAddOn,
}: {
  posts: PostRow[];
  shapes: Shape[];
  /** Signed media per post, for the card thumbnails the frame draws. */
  assets?: Record<string, PostAsset[]>;
  todayKey: string;
  tz: string;
  onOpen: (post: PostRow) => void;
  onAddOn: (day: string) => void;
}) {
  const days = weekOf(todayKey);

  const byDay = new Map<string, PostRow[]>();
  for (const post of posts) {
    if (!post.scheduled_for) continue;
    const key = dayKey(post.scheduled_for, tz);
    const list = byDay.get(key) ?? [];
    list.push(post);
    byDay.set(key, list);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => (a.scheduled_for ?? "").localeCompare(b.scheduled_for ?? ""));
  }

  return (
    // One shell, seven ruled columns sharing a hairline. DESIGN.md section 7:
    // board columns are ruled columns inside one shell, not detached cards, and
    // -ml-px makes each shared edge render as a single rule.
    <div className="flex overflow-hidden rounded-shell border border-rule bg-sheet">
      {days.map((day, i) => {
        const list = byDay.get(day) ?? [];
        const isToday = day === todayKey;
        const dayNumber = Number(day.slice(8, 10));

        return (
          <section
            key={day}
            className={`-ml-px flex min-w-0 flex-1 flex-col border-l border-rule first:ml-0 first:border-l-0 ${
              isToday ? "bg-well" : ""
            }`}
          >
            <div className="flex items-baseline justify-between gap-1 border-b border-rule px-2.5 py-2">
              <span
                className={`legend ${isToday ? "text-violet" : "text-ink-3"}`}
              >
                {LABELS[i]}
              </span>
              <span
                className={`meta ${isToday ? "font-medium text-violet" : "text-ink-3"}`}
              >
                {dayNumber}
              </span>
            </div>

            <div className="flex min-h-[168px] flex-col gap-1.5 p-1.5">
              {list.map((post) => {
                const shape = shapeForPost(post, shapes);
                const accent = skillColour(shape.key);
                const state = statusOf(post);
                const thumb =
                  (assets[post.id] ?? []).find((a) => a.url)?.url ?? null;

                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => onOpen(post)}
                    // The skill hue is a 3px left edge, never a fill.
                    // DESIGN.md section 3: a category hue is an accent, and
                    // status always wins over it.
                    className={`settle w-full rounded-card border border-l-[3px] border-rule bg-sheet px-2 py-1.5 text-left hover:bg-well ${accent.edge}`}
                  >
                    {/* The media going out with the post, per the frame. A
                        post with no media shows no placeholder: an empty slot
                        would imply an image is expected on every post. */}
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="mb-1.5 h-14 w-full rounded-[4px] object-cover"
                      />
                    ) : null}
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={`size-1.5 shrink-0 rounded-chip ${state.dot}`}
                      />
                      <span className={`legend truncate ${state.tone}`}>
                        {state.word}
                      </span>
                    </span>
                    <span className="mt-1 line-clamp-3 block text-[12px] leading-[1.4] text-ink">
                      {post.hook || "Untitled"}
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-1">
                      <span className="legend truncate text-ink-3">
                        {shape.name}
                      </span>
                      {post.scheduled_for ? (
                        <span className="meta shrink-0 text-ink-3">
                          {timeOfDay(post.scheduled_for, tz)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}

              {/* Always mounted, never behind hover. DESIGN.md section 2: a
                  row action revealed on hover is the pattern that fails this
                  audience hardest, and an empty day is exactly where somebody
                  wants to add something. */}
              <button
                type="button"
                onClick={() => onAddOn(day)}
                aria-label={`Add a post on ${LABELS[i]} ${dayNumber}`}
                className="flex h-8 w-full items-center justify-center rounded-card border border-dashed border-rule text-ink-3 hover:border-violet hover:text-violet"
              >
                <span aria-hidden className="text-[15px] leading-none">+</span>
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
