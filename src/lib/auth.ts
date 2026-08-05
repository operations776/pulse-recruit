import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MembershipRow, OrgRow } from "@/lib/supabase/types";

export type Session = {
  userId: string;
  email: string;
  org: OrgRow;
  role: MembershipRow["role"];
};

/**
 * Resolve the caller, once per request.
 *
 * This is the hot path of the entire product. `auth.getUser()` is a network
 * round trip to Supabase Auth, and the membership join is a second one, so
 * every caller of this function used to cost two trips to London. Every
 * function in data.ts calls it, and a page calls several of those: the
 * pipeline was paying for six sequential resolutions before it read a single
 * row, which is most of the 1.4 to 3.6 seconds a navigation took.
 *
 * React's `cache` dedupes within one server request, so the first caller pays
 * and the rest read the memo. It is per request, not shared across users or
 * across time, so there is no window where a signed-out user is served a
 * cached identity. That is the property that makes this safe to do at all.
 */
const resolveSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("role, org_id, orgs(id, name, slug, timezone, created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.orgs) return null;

  return {
    userId: user.id,
    email: user.email ?? "",
    org: membership.orgs as unknown as OrgRow,
    role: membership.role as MembershipRow["role"],
  };
});

// The single place a screen learns who it is acting as. Every query hangs off
// this, and it redirects rather than returning a half session, so no screen can
// accidentally render without an org.
export async function requireSession(): Promise<Session> {
  const session = await resolveSession();

  // Signed in but no org, or not signed in at all. Both mean this screen
  // cannot render, and the redirect target differs: a user with no org needs
  // to finish signup rather than sign in again.
  if (!session) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    redirect(user ? "/signup?step=workspace" : "/signin");
  }

  return session;
}

// The same lookup without the redirect, for a route handler. A route answers
// with a status code; only a screen can be sent somewhere.
export async function sessionOrNull(): Promise<Session | null> {
  return resolveSession();
}

export async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
