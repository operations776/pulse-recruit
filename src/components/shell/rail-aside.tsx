import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PostRow } from "@/lib/supabase/types";
import { dayLabel, timeOfDay } from "@/lib/time";

/**
 * What the rail carries under its nav.
 *
 * The space used to hold `active.blurb`, a static marketing sentence pinned to
 * the floor with mt-auto. It never changed, it was read once, and the mt-auto
 * was what manufactured roughly 700px of void above it. This is the one
 * question the content module exists to answer, visible without opening
 * anything: what goes out next, and is anything past its slot.
 *
 * A server component, streamed by the layout, so a slow query here can never
 * hold up a page render.
 *
 * It renders for every module rather than only content, because the layout
 * does not re-render on navigation and cannot cheaply branch on the path. That
 * is a deliberate trade: the panel is genuinely useful everywhere in the
 * product, since a post going out this afternoon matters whether you happen to
 * be looking at the pipeline or the calendar.
 */
export async function RailAside() {
  const session = await requireSession();
  const supabase = await createClient();
  const tz = session.org.timezone;
  const now = new Date().toISOString();

  const [{ data: upcoming }, { data: overdue }, { count: lessons }] =
    await Promise.all([
      supabase
        .from("content_posts")
        .select("*")
        .eq("author_id", session.userId)
        .not("scheduled_for", "is", null)
        .gte("scheduled_for", now)
        .neq("status", "published")
        .order("scheduled_for", { ascending: true })
        .limit(4),
      supabase
        .from("content_posts")
        .select("*")
        .eq("author_id", session.userId)
        .eq("status", "scheduled")
        .lt("scheduled_for", now)
        .order("scheduled_for", { ascending: true })
        .limit(3),
      supabase
        .from("persona_lessons")
        .select("id", { count: "exact", head: true })
        .is("applied_at", null),
    ]);

  const next = (upcoming ?? []) as PostRow[];
  const late = (overdue ?? []) as PostRow[];

  // Nothing to say beats saying nothing at length. An empty rail is honest;
  // the old blurb filled the same space with words that were never news.
  if (next.length === 0 && late.length === 0 && !lessons) return null;

  const row = (post: PostRow, isLate: boolean) => (
    <li key={post.id}>
      <Link
        href="/content"
        className="block px-3 py-2 hover:bg-well"
        title={post.hook}
      >
        <span
          className={`meta block ${isLate ? "text-amber-text" : "text-ink-3"}`}
        >
          {dayLabel(post.scheduled_for!, tz)} {timeOfDay(post.scheduled_for!, tz)}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[12px] leading-[1.4] text-ink-2">
          {post.hook}
        </span>
      </Link>
    </li>
  );

  return (
    <div className="flex flex-col">
      {late.length > 0 ? (
        <section className="border-t border-rule">
          <p className="legend px-3 pb-1 pt-2.5 text-amber-text">
            Past its slot
          </p>
          <ul className="divide-y divide-rule">
            {late.map((post) => row(post, true))}
          </ul>
        </section>
      ) : null}

      {next.length > 0 ? (
        <section className="border-t border-rule">
          <p className="legend px-3 pb-1 pt-2.5 text-ink-3">Up next</p>
          <ul className="divide-y divide-rule">
            {next.map((post) => row(post, false))}
          </ul>
        </section>
      ) : null}

      {lessons && lessons > 0 ? (
        <Link
          href="/content/persona"
          className="border-t border-rule px-3 py-2.5 text-[12px] leading-[1.4] text-amber-text hover:bg-well"
        >
          {lessons} {lessons === 1 ? "lesson" : "lessons"} waiting on your voice
        </Link>
      ) : null}
    </div>
  );
}
