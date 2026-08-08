import { NextResponse } from "next/server";
import { cronAuthorised } from "@/lib/server/cron-auth";
import { createAdminClient, hasAdminKey } from "@/lib/server/supabase-admin";
import { hasUnipile, publishPost, UnipileError } from "@/lib/server/unipile";

// PLS-88. The publisher.
//
// pg_cron calls this every minute. It claims what is due, sends each post, and
// settles each result. Law 3 in order: claim_due_posts flips a row to
// 'publishing' BEFORE anything reaches LinkedIn, so a crash between the claim
// and the send leaves a row the sweep can find, never a row that goes out
// twice. Law 9: the response carries honest counts, including the failures.
//
// It runs as service-role because a cron has no session. That makes it the
// second sanctioned caller of the admin client, which is documented in
// supabase-admin.ts, ARCHITECTURE.md and DEPLOY.md.

export const runtime = "nodejs";
// Twenty posts against a network API. Longer than any real batch, shorter than
// the ten minute sweep that rescues anything this limit kills.
export const maxDuration = 120;

/**
 * Which failures are about the post, and which are about the account.
 *
 * PLS-135 split the two, because the spec frame is blunt about the cost of not
 * splitting them: "Failed tells the user nothing they can act on." A post
 * LinkedIn refused is `failed` and the words need changing. A post we could not
 * even attempt is `needs_attention`, the attempt goes back, and the fix is
 * reconnecting an account.
 *
 * 401 and 403 are an account whose credentials stopped working. 428 is
 * Unipile's checkpoint status, which means LinkedIn is asking the human for
 * something. 5xx and a timeout are Unipile itself being unreachable, which is
 * also not the post's fault.
 */
function failureKind(error: unknown): "refused" | "unreachable" {
  if (error instanceof UnipileError) {
    if ([401, 403, 428].includes(error.status)) return "unreachable";
    if (error.status >= 500) return "unreachable";
    return "refused";
  }
  // A network error or an abort never reached LinkedIn either.
  return "unreachable";
}

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
    // Nothing to publish through. Say so rather than claiming rows and then
    // failing every one of them, which would burn their three attempts.
    return NextResponse.json(
      { error: "unipile is not configured" },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();

  // Rescue anything a previous run left mid-flight before claiming more, the
  // same order begin_ask uses: a stuck row may be holding a slot this run
  // would otherwise skip.
  const { data: swept } = await supabase.rpc("sweep_stuck_publishes");

  // Before claiming, surface the posts the claim query structurally cannot
  // see. claim_due_posts inner joins a connected account, so a due post in a
  // workspace whose LinkedIn expired is never selected and sits in `scheduled`
  // past its date forever, looking only like something overdue on a calendar.
  const { data: flagged } = await supabase.rpc("flag_unpublishable_posts");

  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_due_posts",
    { batch: 20 },
  );
  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }

  const due = (claimed ?? []) as {
    post_id: string;
    org_id: string;
    body: string;
    unipile_account_id: string | null;
  }[];

  let published = 0;
  let failed = 0;
  let attention = 0;

  for (const post of due) {
    if (!post.unipile_account_id) {
      // Never reached LinkedIn, so this is the account's problem, not the
      // post's, and the attempt it just burned goes back.
      await supabase.rpc("finish_publish", {
        target_post: post.post_id,
        failure:
          "No connected LinkedIn account for this workspace, so the post could not go out. Connect one in Settings, Channels.",
        failure_kind: "unreachable",
      });
      attention += 1;
      continue;
    }

    try {
      const result = await publishPost({
        accountId: post.unipile_account_id,
        text: post.body,
      });
      await supabase.rpc("finish_publish", {
        target_post: post.post_id,
        post_id_external: result.postId,
        url: result.url,
      });
      published += 1;
    } catch (error) {
      // The real reason, on the row, so the calendar can show it. A generic
      // "publishing failed" tells a recruiter nothing they can act on.
      const message =
        error instanceof UnipileError
          ? error.message
          : error instanceof Error
            ? error.message
            : "The post did not publish.";
      const kind = failureKind(error);
      await supabase.rpc("finish_publish", {
        target_post: post.post_id,
        failure: message,
        failure_kind: kind,
      });
      if (kind === "unreachable") attention += 1;
      else failed += 1;
    }
  }

  // Law 9: honest counts, and the two kinds of unhappy ending are reported
  // separately because they are separately actionable.
  return NextResponse.json({
    ok: true,
    claimed: due.length,
    published,
    failed,
    attention,
    flagged: (flagged as number) ?? 0,
    swept: (swept as number) ?? 0,
  });
}

// pg_net posts; a browser hitting this by hand should get an explanation.
export function GET() {
  return NextResponse.json(
    { error: "this endpoint only accepts POST from the scheduler" },
    { status: 405 },
  );
}
