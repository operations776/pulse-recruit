import type { PostMetricsRow, PostRow } from "@/lib/supabase/types";

// PLS-189. "When should this go out?", ranked by what actually happened.
//
// A slot is a weekday and a time of day. The ranking is an average of real
// impressions for posts published in that slot, this skill first and the
// whole account as fallback, because three posts of one skill is a thin base
// but it is THEIR base. Where there is no history at all the popover still
// offers three sensible slots and says plainly that they are defaults, not
// findings: a reason string that cannot cite a number never pretends to.
//
// Pure function of its inputs. The caller hands in todayKey resolved on the
// server, so nothing here reads a clock during render.

export type SlotSuggestion = {
  /** YYYY-MM-DD of the next occurrence of this slot. */
  day: string;
  /** HH:mm, workspace zone. */
  time: string;
  /** "Tue 11 Aug, 08:30" */
  label: string;
  /** Why this slot: a cited average, or an honest "no history". */
  reason: string;
  /** True on the top slot only, and only when it is backed by data. */
  best: boolean;
};

const DEFAULTS: { weekday: number; time: string }[] = [
  { weekday: 2, time: "08:30" },
  { weekday: 4, time: "12:00" },
  { weekday: 1, time: "17:00" },
];

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

/** The next date key on or after `fromKey` + 1 day that lands on `weekday`. */
function nextOccurrence(fromKey: string, weekday: number): string {
  const [y, m, d] = fromKey.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  for (let i = 1; i <= 7; i++) {
    const candidate = new Date(base);
    candidate.setUTCDate(candidate.getUTCDate() + i);
    if (candidate.getUTCDay() === weekday) {
      return candidate.toISOString().slice(0, 10);
    }
  }
  return fromKey;
}

function slotLabel(day: string, time: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const formatted = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
  return `${formatted}, ${time}`;
}

export function rankSlots({
  posts,
  metricsByPost,
  skillKey,
  skillName,
  todayKey,
  tz,
}: {
  posts: PostRow[];
  metricsByPost: Record<string, PostMetricsRow>;
  skillKey: string;
  skillName: string;
  todayKey: string;
  tz: string;
}): SlotSuggestion[] {
  type Bucket = { total: number; count: number; time: string; weekday: number };

  const bucketsFor = (subset: PostRow[]) => {
    const map = new Map<string, Bucket>();
    for (const post of subset) {
      if (post.status !== "published" || !post.published_at) continue;
      const views = metricsByPost[post.id]?.impressions;
      if (typeof views !== "number") continue;

      const when = new Date(post.published_at);
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(when);
      const weekdayWord = parts.find((p) => p.type === "weekday")?.value ?? "";
      const hour = parts.find((p) => p.type === "hour")?.value ?? "09";
      const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
      const weekday = WEEKDAY_LABEL.findIndex((w) => weekdayWord.startsWith(w));
      if (weekday < 0) continue;

      const key = `${weekday}:${hour}`;
      const bucket = map.get(key) ?? {
        total: 0,
        count: 0,
        time: `${hour}:${minute}`,
        weekday,
      };
      bucket.total += views;
      bucket.count += 1;
      map.set(key, bucket);
    }
    return [...map.values()].sort(
      (a, b) => b.total / b.count - a.total / a.count,
    );
  };

  // This skill's own history first; the whole account only when the skill has
  // none, and the reason says which base it is citing.
  const own = bucketsFor(posts.filter((p) => p.skill === skillKey));
  const all = own.length > 0 ? own : bucketsFor(posts);
  const base = own.length > 0 ? `your ${skillName.toLowerCase()} posts` : "your posts";

  const out: SlotSuggestion[] = [];
  const used = new Set<string>();

  for (const bucket of all.slice(0, 3)) {
    const day = nextOccurrence(todayKey, bucket.weekday);
    const avg = bucket.total / bucket.count;
    used.add(`${bucket.weekday}`);
    out.push({
      day,
      time: bucket.time,
      label: slotLabel(day, bucket.time),
      reason:
        out.length === 0
          ? `${base.charAt(0).toUpperCase()}${base.slice(1)} average ${compact(avg)} views in this slot`
          : `Averages ${compact(avg)} views across ${bucket.count} ${bucket.count === 1 ? "post" : "posts"}`,
      best: out.length === 0,
    });
  }

  // Fill to three with defaults that say they are defaults.
  for (const fallback of DEFAULTS) {
    if (out.length >= 3) break;
    if (used.has(`${fallback.weekday}`)) continue;
    used.add(`${fallback.weekday}`);
    const day = nextOccurrence(todayKey, fallback.weekday);
    out.push({
      day,
      time: fallback.time,
      label: slotLabel(day, fallback.time),
      reason: "No posting history in this slot yet",
      best: false,
    });
  }

  return out.slice(0, 3);
}
