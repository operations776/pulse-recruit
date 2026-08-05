import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * The service-role client. Two callers, both sessionless, both named here.
 *
 * 1. The Unipile webhook (`/api/unipile/accounts`). Unipile posts an account
 *    connection from its own servers, so there is nobody for a policy to
 *    check. The alternative was granting the write to `anon`, which would let
 *    anyone on the internet attach a LinkedIn account id to any org.
 * 2. The publisher (`/api/cron/publish`), added in PLS-88. A scheduler has no
 *    user either, and it works across every org at once, which is the second
 *    case ARCHITECTURE.md rule 4 names: "webhooks, cross-org admin jobs".
 *
 * ARCHITECTURE.md rule 4 allows this exactly where RLS genuinely cannot express
 * the operation. Adding a third caller means changing this note, the
 * ARCHITECTURE.md note, and the DEPLOY.md instruction, in the same commit.
 *
 * Rules for this module:
 * - It is never imported by a client component. `server-only` makes that a
 *   build error rather than a leak.
 * - It is never used to serve a browser request that has a session. Those go
 *   through the RLS-constrained client in src/lib/supabase/server.ts.
 * - Session persistence is off. This client has no user and must never write a
 *   refresh token anywhere.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set, so the Unipile webhook cannot record an account.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasAdminKey(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
