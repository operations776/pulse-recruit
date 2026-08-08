import { NextResponse } from "next/server";
import { cronAuthorised } from "@/lib/server/cron-auth";
import { createAdminClient, hasAdminKey } from "@/lib/server/supabase-admin";
import { getPostStats, hasUnipile, UnipileError } from "@/lib/server/unipile";

// PLS-137. The metrics refresher.
//
// The content redesign prints views, likes and replies, and ranks posting slots
// by them. This is where those numbers come from, and it is the only writer of
// `post_metrics`.
//
// Three properties worth stating, because each one is a rule being followed
// rather than a preference:
//
//   Nothing is reserved. Law 3 makes a paid call claim credits first. This is a
//   read, and Unipile bills per connected account per month rather than per
//   call, so there is no money to reserve and no irreversible effect to claim
//   ahead of. `begin_ask` here would spend a customer's weekly allowance on
//   data they did not ask for.
//
//   A missing figure is written as null, never 0. `post_metrics` is nullable
//   for exactly this reason: zero is a measurement and null is an absence, and
//   the difference is the whole reason the columns are shaped that way.
//
//   Only posts Pulse sent are refreshed. A post without a `unipile_post_id` was
//   never published through us, so there is nothing to ask about. Those rows
//   stay without metrics and the UI says why rather than showing a zero.
//
// Second scheduled route, so the constant-time secret check now lives in
// src/lib/server/cron-auth.ts and both import it. No new env var: this reuses
// CRON_SECRET, so the ARCHITECTURE.md table is unchanged.

export const runtime = "nodejs";
// Forty posts against a network API, one call each. Comfortably inside the
// window, and the cap is what keeps a large backlog from timing out rather than
// draining a page at a time.
export const maxDuration = 120;

/** How stale a row has to be before it is worth asking again. */
const STALE_AFTER_HOURS = 6;

/** One page. A backlog drains over successive runs, oldest first. */
const BATCH = 40;

type DuePost = {
  id: string;
  org_id: string;
  unipile_post_id: string;
  linkedin_account_id: string | null;
};

export async function POST(request: Request) {
  if (!cronAuthorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  if (!hasAdminKey()) {
    return NextResponse.json(
      { error: "the service role key is not configured" },
      { status: 503 },
    );
  }
  if (!hasUnipile()) {
    return NextResponse.json(
      { error: "unipile is not configured" },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  const staleBefore = new Date(
    Date.now() - STALE_AFTER_HOURS * 3_600_000,
  ).toISOString();

  // Which posts have never been measured, or were measured long enough ago to
  // be worth asking about again. Two reads rather than a join, because
  // PostgREST cannot express "left join where the right side is null or old"
  // without a view, and a view here would be a schema object serving one query.
  const { data: fresh } = await supabase
    .from("post_metrics")
    .select("post_id")
    .gte("fetched_at", staleBefore);

  const skip = new Set(
    ((fresh ?? []) as { post_id: string }[]).map((row) => row.post_id),
  );

  const { data: candidates, error } = await supabase
    .from("content_posts")
    .select("id, org_id, unipile_post_id, linkedin_account_id")
    .eq("status", "published")
    .not("unipile_post_id", "is", null)
    // A post from years ago is not going to move. Bounded so the query does not
    // grow without limit as the workspace ages.
    .gte("published_at", new Date(Date.now() - 90 * 86_400_000).toISOString())
    .order("published_at", { ascending: false })
    .limit(BATCH * 4);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const due = ((candidates ?? []) as DuePost[])
    .filter((post) => !skip.has(post.id))
    .slice(0, BATCH);

  // The account each post went out as. Only connected accounts can answer: a
  // stats call against one in `credentials` state returns 401 and would burn
  // the rest of the batch behind it.
  const accountIds = [
    ...new Set(due.map((p) => p.linkedin_account_id).filter(Boolean)),
  ] as string[];

  type AccountRow = { id: string; unipile_account_id: string; status: string };

  const { data: accounts } = accountIds.length
    ? await supabase
        .from("linkedin_accounts")
        .select("id, unipile_account_id, status")
        .in("id", accountIds)
    : { data: [] as AccountRow[] };

  const usable = new Map<string, string>();
  for (const account of (accounts ?? []) as AccountRow[]) {
    if (account.status === "connected") {
      usable.set(account.id, account.unipile_account_id);
    }
  }

  let refreshed = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of due) {
    const accountId = post.linkedin_account_id
      ? usable.get(post.linkedin_account_id)
      : undefined;

    if (!accountId) {
      // No usable account to ask through. Not a failure of this post, and not
      // something to record as a zero.
      skipped += 1;
      continue;
    }

    try {
      const stats = await getPostStats({
        accountId,
        postId: post.unipile_post_id,
      });

      // Law 2: the unique index on post_id is the race guard, so this is an
      // upsert that tolerates a conflict rather than a select then an insert.
      const { error: writeError } = await supabase.from("post_metrics").upsert(
        {
          org_id: post.org_id,
          post_id: post.id,
          impressions: stats.impressions,
          likes: stats.likes,
          comments: stats.comments,
          reposts: stats.reposts,
          source: "unipile",
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "post_id" },
      );

      if (writeError) failed += 1;
      else refreshed += 1;
    } catch (caught) {
      // One post LinkedIn will not answer for must not stop the other 39. The
      // row simply keeps whatever it had, or stays absent.
      if (caught instanceof UnipileError && caught.status === 404) {
        // The post is gone from LinkedIn. Nothing to measure, ever.
        skipped += 1;
      } else {
        failed += 1;
      }
    }
  }

  // Law 9: honest counts. `skipped` is not a failure and is reported apart from
  // one, because a workspace with no connected account will show only skips and
  // that is the correct, diagnosable answer.
  return NextResponse.json({
    ok: true,
    considered: due.length,
    refreshed,
    skipped,
    failed,
  });
}

// pg_net posts; a browser hitting this by hand should get an explanation.
export function GET() {
  return NextResponse.json(
    { error: "this endpoint only accepts POST from the scheduler" },
    { status: 405 },
  );
}
