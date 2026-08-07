// The quick add reads a sentence.
//
// "Chase Rylee Thiel tomorrow 3pm p1 @salar" has to become a title, a date, a
// priority, an owner and a link, and the row under the input has to show what
// it understood BEFORE the user commits. That preview runs in the browser and
// the write runs on the server, so the parse lives here, as one pure function
// both call. Parsing twice is not duplication: the client parse is a preview
// and the server parse is the truth, because a client that posts a task_id and
// a due date it chose itself is a client the server has trusted.
//
// Everything is resolved against a caller-supplied day key and timezone rather
// than the machine clock. Same reason the content calendar takes one: "tomorrow"
// is a property of a day read inside a zone, and a server in one zone and a
// browser in another disagree about it for six hours out of twenty-four.
import type { TaskPriority } from "@/lib/supabase/types";
import { RANK_TO_PRIORITY } from "@/lib/tasks";
import { instantAt } from "@/lib/time";

export type ParseMember = {
  user_id: string;
  display_name: string;
  email: string;
};

export type ParseLink = {
  id: string;
  name: string;
  kind: "candidate" | "company";
};

export type ParsedTask = {
  /** What is left after the date, time, priority and @handles are lifted out. */
  title: string;
  /** The instant, or null when nothing in the sentence named a day. */
  due: string | null;
  /** "8 AUG 15:00", for the reads-as row. Null when there is no date. */
  dueLabel: string | null;
  priority: TaskPriority | null;
  assignees: ParseMember[];
  /** An @handle that matched nobody. Worth saying out loud, not worth failing on. */
  unknownHandles: string[];
  link: ParseLink | null;
};

export type ParseContext = {
  /** "YYYY-MM-DD" for today, read inside `tz`. */
  todayKey: string;
  tz: string;
  members: ParseMember[];
  links: ParseLink[];
};

/** 17:00 when a day was named without a time. The end of a working day. */
const DEFAULT_TIME = "17:00";

const WEEKDAYS = [
  ["sunday", "sun"],
  ["monday", "mon"],
  ["tuesday", "tue", "tues"],
  ["wednesday", "wed"],
  ["thursday", "thu", "thur", "thurs"],
  ["friday", "fri"],
  ["saturday", "sat"],
];

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** A span of the raw string that has been claimed by one of the readers. */
type Span = { start: number; end: number };

export function parseTaskInput(raw: string, ctx: ParseContext): ParsedTask {
  const text = raw ?? "";
  const claimed: Span[] = [];
  // A claim covers the whole match, leading separator included. Every pattern
  // below opens with (?:^|\s) and closes with a lookahead, so the match is
  // exactly the phrase plus the space in front of it, and strip() collapses
  // what is left rather than leaving two words welded together.
  const claim = (m: RegExpExecArray) => {
    claimed.push({ start: m.index, end: m.index + m[0].length });
  };

  // --- priority --------------------------------------------------------------
  let priority: TaskPriority | null = null;
  const priorityMatch = /(?:^|\s)p([1-4])(?=\s|$)/i.exec(text);
  if (priorityMatch) {
    priority = RANK_TO_PRIORITY[Number(priorityMatch[1])] ?? null;
    claim(priorityMatch);
  }

  // --- @handles --------------------------------------------------------------
  const assignees: ParseMember[] = [];
  const unknownHandles: string[] = [];
  const handles = /(?:^|\s)@([a-z0-9._-]+)/gi;
  let handle: RegExpExecArray | null;
  while ((handle = handles.exec(text)) !== null) {
    const found = matchMember(handle[1], ctx.members);
    if (found) {
      if (!assignees.some((a) => a.user_id === found.user_id)) assignees.push(found);
    } else {
      unknownHandles.push(handle[1]);
    }
    // An unmatched handle is still lifted out of the title. Leaving "@salaar"
    // in the title of a task nobody is assigned to reads as a silent failure.
    claim(handle);
  }

  // --- the day ---------------------------------------------------------------
  const day = readDay(text, ctx.todayKey, claim);

  // --- the time --------------------------------------------------------------
  const time = readTime(text, claim);

  // --- what is left is the title ---------------------------------------------
  const title = strip(text, claimed);

  // A bare time with no day means the next occurrence of that time today; a
  // bare day means the end of that day. A time on its own before now is still
  // today, because "3pm" typed at 4pm most often means the 3pm that just went
  // and the row belongs in Overdue rather than silently a day out.
  const dayKeyOut = day ?? (time ? ctx.todayKey : null);
  const timeOut = time ?? DEFAULT_TIME;

  return {
    title,
    due: dayKeyOut ? instantAt(dayKeyOut, timeOut, ctx.tz) : null,
    dueLabel: dayKeyOut ? `${shortDay(dayKeyOut)} ${timeOut}` : null,
    priority,
    assignees,
    unknownHandles,
    link: matchLink(title, ctx.links),
  };
}

/* ---------------------------------------------------------------------------
 * Readers
 * ------------------------------------------------------------------------- */

function readDay(
  text: string,
  todayKey: string,
  claim: (m: RegExpExecArray) => void,
): string | null {
  const today = /(?:^|\s)(today|tonight)(?=\s|$)/i.exec(text);
  if (today) {
    claim(today);
    return todayKey;
  }

  const tomorrow = /(?:^|\s)(tomorrow|tmrw|tmr)(?=\s|$)/i.exec(text);
  if (tomorrow) {
    claim(tomorrow);
    return addDays(todayKey, 1);
  }

  const inDays = /(?:^|\s)in\s+(\d{1,2})\s+days?(?=\s|$)/i.exec(text);
  if (inDays) {
    claim(inDays);
    return addDays(todayKey, Number(inDays[1]));
  }

  const weekday = new RegExp(
    `(?:^|\\s)(?:(next)\\s+)?(${WEEKDAYS.flat().join("|")})(?=\\s|$)`,
    "i",
  ).exec(text);
  if (weekday) {
    claim(weekday);
    const wanted = WEEKDAYS.findIndex((names) =>
      names.includes(weekday[2].toLowerCase()),
    );
    return nextWeekday(todayKey, wanted, Boolean(weekday[1]));
  }

  // "8 aug", "8 august", and the same pair the other way round.
  const dayMonth = new RegExp(
    `(?:^|\\s)(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s+(${MONTHS.map((m) => `${m}|${m.slice(0, 3)}`).join("|")})(?=\\s|$)`,
    "i",
  ).exec(text);
  if (dayMonth) {
    claim(dayMonth);
    return onOrAfter(todayKey, monthIndex(dayMonth[2]), Number(dayMonth[1]));
  }

  const monthDay = new RegExp(
    `(?:^|\\s)(${MONTHS.map((m) => `${m}|${m.slice(0, 3)}`).join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?=\\s|$)`,
    "i",
  ).exec(text);
  if (monthDay) {
    claim(monthDay);
    return onOrAfter(todayKey, monthIndex(monthDay[1]), Number(monthDay[2]));
  }

  // Day-first, because the product is British. 8/9 is the eighth of September.
  const numeric = /(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s|$)/.exec(text);
  if (numeric) {
    claim(numeric);
    const [, d, m, y] = numeric;
    if (y) {
      const year = y.length === 2 ? 2000 + Number(y) : Number(y);
      return key(year, Number(m) - 1, Number(d));
    }
    return onOrAfter(todayKey, Number(m) - 1, Number(d));
  }

  return null;
}

function readTime(
  text: string,
  claim: (m: RegExpExecArray) => void,
): string | null {
  // 3pm, 3.30pm, 9:15am
  const meridiem = /(?:^|\s)(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)(?=\s|$)/i.exec(text);
  if (meridiem) {
    claim(meridiem);
    let hour = Number(meridiem[1]) % 12;
    if (meridiem[3].toLowerCase() === "pm") hour += 12;
    return `${pad(hour)}:${meridiem[2] ?? "00"}`;
  }

  // 15:00. Requires the colon: a bare "1500" is far more often a salary than a
  // time, and this input also carries names and numbers.
  const clock = /(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/.exec(text);
  if (clock) {
    claim(clock);
    return `${pad(Number(clock[1]))}:${clock[2]}`;
  }

  return null;
}

function matchMember(handle: string, members: ParseMember[]): ParseMember | null {
  const wanted = handle.toLowerCase();
  return (
    members.find((m) => m.email.split("@")[0].toLowerCase() === wanted) ??
    members.find((m) => m.display_name.toLowerCase() === wanted) ??
    members.find(
      (m) => m.display_name.split(/\s+/)[0].toLowerCase() === wanted,
    ) ??
    members.find((m) => m.display_name.toLowerCase().startsWith(wanted)) ??
    null
  );
}

/**
 * The record the title is talking about.
 *
 * Longest name first, so "Verity Labs" wins over a company called "Verity".
 * The name is NOT lifted out of the title: "Chase Rylee Thiel" is the task, and
 * a title reading "Chase" with the person hidden in a chip is worse than the
 * sentence the user typed.
 */
function matchLink(title: string, links: ParseLink[]): ParseLink | null {
  const haystack = title.toLowerCase();
  let best: ParseLink | null = null;
  for (const link of links) {
    const name = link.name.trim().toLowerCase();
    if (name.length < 3 || !haystack.includes(name)) continue;
    if (!best || name.length > best.name.trim().length) best = link;
  }
  return best;
}

/* ---------------------------------------------------------------------------
 * Day arithmetic on "YYYY-MM-DD"
 *
 * Bare day keys, parsed as UTC. There is no instant involved until instantAt
 * turns the pair into one, so no timezone can shift a date here by a day.
 * ------------------------------------------------------------------------- */

function key(year: number, monthIdx: number, day: number): string {
  const d = new Date(Date.UTC(year, monthIdx, day));
  return d.toISOString().slice(0, 10);
}

function addDays(dayKeyIn: string, delta: number): string {
  const [y, m, d] = dayKeyIn.split("-").map(Number);
  return key(y, m - 1, d + delta);
}

function nextWeekday(todayKey: string, wanted: number, forceNext: boolean): string {
  const [y, m, d] = todayKey.split("-").map(Number);
  const current = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  let delta = (wanted - current + 7) % 7;
  // "friday" said on a Friday means next Friday, not this morning. "next
  // friday" said on a Wednesday means the one after this week's.
  if (delta === 0) delta = 7;
  if (forceNext && delta < 7) delta += 7;
  return addDays(todayKey, delta);
}

/** The given day and month, this year, or next year if it has already gone. */
function onOrAfter(todayKey: string, monthIdx: number, day: number): string {
  const year = Number(todayKey.slice(0, 4));
  const candidate = key(year, monthIdx, day);
  return candidate >= todayKey ? candidate : key(year + 1, monthIdx, day);
}

function monthIndex(name: string): number {
  const wanted = name.toLowerCase();
  return MONTHS.findIndex((m) => m === wanted || m.slice(0, 3) === wanted);
}

/** "8 AUG", for the reads-as chip. */
function shortDay(dayKeyIn: string): string {
  const [y, m, d] = dayKeyIn.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .toUpperCase();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The raw text with every claimed span removed and the whitespace tidied. */
function strip(text: string, claimed: Span[]): string {
  if (claimed.length === 0) return text.trim();
  const ordered = [...claimed].sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const span of ordered) {
    if (span.start < cursor) continue; // overlapping claims: first one wins
    out += text.slice(cursor, span.start);
    cursor = span.end;
  }
  out += text.slice(cursor);
  return out.replace(/\s+/g, " ").trim();
}
