// Relative labels are measured against the real current time now that the rows
// come from Supabase. A caller can still pass an explicit `now` when it needs a
// fixed reference, for example a test.
export function relativeTime(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Calendar time. Everything below takes the org's timezone explicitly.
//
// A day is not a property of an instant, it is a property of an instant read
// inside a zone. The server renders in the host's zone and the browser renders
// in the viewer's, so anything that derives a day from the machine clock puts a
// post on square 3 during SSR and square 4 after hydration. Passing the org
// zone into both makes them agree, and it is also the honest answer for a
// London agency whose operator is sitting in Karachi.
// ---------------------------------------------------------------------------

/** YYYY-MM-DD for an instant, read inside `tz`. Sorts and compares as text. */
export function dayKey(iso: string | Date, tz: string): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  // en-CA gives ISO order natively, which avoids reassembling parts by hand.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** HH:MM for an instant, read inside `tz`. */
export function timeOfDay(iso: string | Date, tz: string): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** "Mon 4 Aug" for a row label, read inside `tz`. */
export function dayLabel(iso: string | Date, tz: string): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

/**
 * The instant at which `HH:MM` on `day` occurs inside `tz`.
 *
 * There is no built-in inverse of Intl, so this measures the zone's offset at
 * roughly the target moment and subtracts it. Two passes because the offset at
 * the guessed instant can belong to the wrong side of a DST boundary, and the
 * second pass lands on the right side. Times that a DST jump deletes resolve to
 * the following hour rather than throwing, which is what a scheduler should do.
 */
export function instantAt(day: string, time: string, tz: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wanted = Date.UTC(y, m - 1, d, hh, mm);

  let guess = wanted;
  for (let pass = 0; pass < 2; pass++) {
    guess = wanted + (guess - zonedUtc(guess, tz));
  }
  return new Date(guess).toISOString();
}

/** The wall-clock reading of `instant` inside `tz`, expressed as a UTC stamp. */
function zonedUtc(instant: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(instant));

  const at = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  // hour can format as 24 at midnight in some locales, and Date.UTC rolls it
  // over correctly, so it needs no special case.
  return Date.UTC(
    at("year"),
    at("month") - 1,
    at("day"),
    at("hour"),
    at("minute"),
    at("second"),
  );
}

/** The Monday-first weeks covering `month` ("YYYY-MM"), as day keys. */
export type GridCell = { day: string; inMonth: boolean; weekend: boolean };

export function monthGrid(month: string): GridCell[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  // Monday is column 0. getUTCDay puts Sunday at 0, so rotate by 6.
  const lead = (first.getUTCDay() + 6) % 7;

  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - lead);

  const weeks: GridCell[][] = [];
  // Six rows always. A grid that changes height as you page months makes the
  // whole screen jump, and the empty row costs nothing.
  for (let w = 0; w < 6; w++) {
    const week: GridCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        day: cursor.toISOString().slice(0, 10),
        inMonth: cursor.getUTCMonth() === m - 1,
        // Columns 5 and 6, because Monday is column 0. Taken from the position
        // rather than the date so it cannot disagree with the header labels.
        weekend: i >= 5,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** "August 2026" for the month header. */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** The month `delta` months from `month`, as "YYYY-MM". */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Whether a "YYYY-MM" string is one we are willing to render. */
export function isMonth(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
