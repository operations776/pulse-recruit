import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MembershipRow, OrgRow } from "@/lib/supabase/types";

export type Session = {
  userId: string;
  email: string;
  org: OrgRow;
  role: MembershipRow["role"];
};

// The single place a screen learns who it is acting as. Every query hangs off
// this, and it redirects rather than returning a half session, so no screen can
// accidentally render without an org.
export async function requireSession(): Promise<Session> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/signin");

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("role, org_id, orgs(id, name, slug, timezone, created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Signed in but no org yet: the signup RPC did not complete. Send them back
  // to finish rather than rendering an empty product.
  if (!membership?.orgs) redirect("/signup?step=workspace");

  const org = membership.orgs as unknown as OrgRow;

  return {
    userId: user.id,
    email: user.email ?? "",
    org,
    role: membership.role as MembershipRow["role"],
  };
}

// The same lookup without the redirect, for a route handler. A route answers
// with a status code; only a screen can be sent somewhere.
export async function sessionOrNull(): Promise<Session | null> {
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
}

export async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
