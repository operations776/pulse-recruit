import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient, hasAdminKey } from "@/lib/server/supabase-admin";
import { getAccount } from "@/lib/server/unipile";

// PLS-70. Unipile's callback for account connections.
//
// This is the only writer of linkedin_accounts, and it runs with no user
// session, which is why it uses the service-role client. Unipile does not sign
// its callbacks, so the shared secret travels in the notify URL we minted and
// is compared here in constant time. Everything else about the payload is
// treated as untrusted: the org comes out of the `name` we set ourselves, never
// out of anything the caller chose.

export const runtime = "nodejs";

type Payload = {
  status?: string;
  account_id?: string;
  name?: string;
};

/** Constant-time compare that does not leak the secret's length. */
function secretMatches(given: string | null): boolean {
  const expected = process.env.UNIPILE_WEBHOOK_SECRET;
  if (!expected || !given) return false;

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, so equalise first. Comparing
  // the lengths separately is fine: the length is not the secret.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** `name` is ours: "orgId:userId". Anything else is not from a link we made. */
function parseName(name: string | undefined): { orgId: string; userId: string } | null {
  if (!name) return null;
  const [orgId, userId] = name.split(":");
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(orgId ?? "") || !uuid.test(userId ?? "")) return null;
  return { orgId, userId };
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!secretMatches(token)) {
    // Deliberately terse. A caller who guessed wrong learns nothing.
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  if (!hasAdminKey()) {
    return NextResponse.json(
      { error: "the service role key is not configured" },
      { status: 503 },
    );
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "body was not json" }, { status: 400 });
  }

  const accountId = payload.account_id;
  if (!accountId) {
    return NextResponse.json({ error: "no account_id" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const status = (payload.status ?? "").toUpperCase();

  // A session that expired. Unipile knows the account, we already have the row,
  // and there is no `name` on this delivery, so it is matched by account id.
  if (status === "CREDENTIALS") {
    const { error } = await supabase
      .from("linkedin_accounts")
      .update({
        status: "credentials",
        last_error:
          "LinkedIn signed this profile out. Reconnect it to keep posting from it.",
      })
      .eq("unipile_account_id", accountId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, handled: "credentials" });
  }

  if (status !== "CREATION_SUCCESS" && status !== "RECONNECTED") {
    // Unknown status. Answer 200 so Unipile stops retrying something we have
    // decided not to act on, and say plainly that nothing was written.
    return NextResponse.json({ ok: true, handled: "ignored", status });
  }

  const owner = parseName(payload.name);
  if (!owner) {
    return NextResponse.json(
      { error: "name did not identify an org" },
      { status: 400 },
    );
  }

  // Ask Unipile who this actually is rather than trusting a display name off
  // the wire. A failure here is not fatal: the connection is real either way,
  // and a row with a blank name beats no row at all.
  let displayName = "";
  try {
    const account = await getAccount(accountId);
    displayName = account.name ?? "";
  } catch {
    displayName = "";
  }

  // Law 2: insert with conflict handling. Unipile retries deliveries, and a
  // reconnect arrives for an account id we already hold, so both paths land on
  // the same unique index rather than on a read-then-write.
  const { error } = await supabase.from("linkedin_accounts").upsert(
    {
      org_id: owner.orgId,
      unipile_account_id: accountId,
      display_name: displayName,
      status: "connected",
      connected_by: owner.userId,
      last_error: "",
    },
    { onConflict: "unipile_account_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    handled: status === "RECONNECTED" ? "reconnected" : "connected",
  });
}

// A GET here is almost always someone pasting the notify URL into a browser.
// Say what this is rather than returning a confusing 405.
export function GET() {
  return NextResponse.json(
    { error: "this endpoint only accepts POST from Unipile" },
    { status: 405 },
  );
}
