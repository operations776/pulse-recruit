-- PLS-72. The anon revoke has never actually worked, in either session's code.
--
-- Supabase ships ALTER DEFAULT PRIVILEGES granting EXECUTE on new functions in
-- `public` to anon, authenticated and service_role. That is an EXPLICIT grant
-- to anon, so `revoke execute ... from public` removes only the PUBLIC entry
-- and leaves anon's grant untouched. Three earlier migrations tried to close
-- this (revoke_rpc_execute_from_anon, revoke_execute_from_public_properly,
-- restore_policy_predicate_execute) and the Supabase security advisor still
-- reported ten functions as callable by anon over /rest/v1/rpc.
--
-- In practice most of them were saved by their own first line, `if not
-- is_org_member(...) then raise exception 'forbidden'`, which is defence in
-- depth doing its job for an anonymous caller whose auth.uid() is null. One was
-- not: roll_credit_week is SECURITY DEFINER, takes an org id, and has no
-- membership check at all. Its `resets_at <= now()` guard means an anonymous
-- caller can only trigger a roll that was already due, so the impact is small,
-- but it is still an unauthenticated write to another tenant's row.
--
-- The fix is to name anon explicitly everywhere, and to stop relying on the
-- default privileges being what we assume.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.

-- 1. RPCs the app calls from a signed-in session. Authenticated keeps EXECUTE.
revoke execute on function create_post(uuid, content_skill, text, timestamptz)
  from public, anon;
revoke execute on function delete_post(uuid) from public, anon;
revoke execute on function create_task(uuid, text, text, timestamptz, uuid, text)
  from public, anon;
revoke execute on function begin_ask(uuid, chat_surface, text, integer)
  from public, anon;
revoke execute on function finish_ask(uuid, text, jsonb, integer, chat_status, jsonb, text)
  from public, anon;
revoke execute on function sweep_stalled_asks(uuid) from public, anon;

-- 2. Internal only. begin_ask calls this as SECURITY DEFINER, so it runs as the
--    owner and does not need a client grant, exactly like next_ref.
revoke execute on function roll_credit_week(uuid) from public, anon, authenticated;

-- 3. Trigger functions. Nothing should ever call these directly.
revoke execute on function touch_updated_at() from public, anon, authenticated;
revoke execute on function assert_known_timezone() from public, anon, authenticated;

-- Deliberately still callable by anon, and each for a stated reason:
--   is_org_member, has_org_role, storage_org: policy predicates, evaluated
--     inside policies that anon-role queries also run through.
--   public_shortlist: the token-addressed public shortlist page is meant to
--     work without a session.
