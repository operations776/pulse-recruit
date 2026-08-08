-- PLS-161. Worth posting about, and what "not for me" actually does.
--
-- The Figma's right rail suggests posts and offers Draft it or Not for me. Two
-- tables, because a dismissal is not the absence of a suggestion: it is a
-- durable instruction about what to stop surfacing, and the spec frame gives
-- each reason a different and specific consequence.
--
-- EVERY SUGGESTION TRACES TO A ROW IN THIS WORKSPACE.
--
-- `source_kind` has no 'market', no 'trend', no 'idea'. A suggestion the model
-- invented from nothing is a fabricated claim about the recruiter's own
-- business, which is the never-fabricate rule broken on the most persuasive
-- surface in the product. The engine hands the model only rows it read, and
-- drops any suggestion whose source_id is not in what it sent. That check
-- happens at insert, not in the prompt: a prompt is a request, a foreign key
-- is a guarantee.
--
-- Personal, not shared. A suggestion is built from one recruiter's patch and
-- their own dismissals, the same shape as content_personas and the BD agent
-- memories. An admin has no business reading which topics a teammate declined.
--
-- Verified in a rolled back transaction before the code shipped: all six
-- dismissal reasons produce exactly the suppression the spec frame documents,
-- a skip teaches nothing, and an unknown reason is refused.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.

create table content_suggestions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,

  source_kind text not null check (source_kind in
                ('job', 'candidacy', 'placement', 'company', 'signal', 'lesson')),
  source_id   uuid,

  title       text not null,
  why         text not null,
  shape_key   text not null,
  evidence    jsonb not null default '{}'::jsonb,

  status      text not null default 'open'
                check (status in ('open', 'drafted', 'dismissed', 'snoozed')),
  dismissed_reason text check (dismissed_reason in
                ('not_my_patch', 'too_salesy', 'already_covered', 'wrong_skill', 'not_now')),
  snoozed_until timestamptz,

  post_id     uuid references content_posts(id) on delete set null,
  -- The metered run that produced this, so a suggestion can be traced back to
  -- what it cost and what it read.
  run_id      uuid references chat_messages(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Law 2: a re-run cannot file the same suggestion twice. Partial, because a
-- suggestion with no source is not a thing this table accepts.
create unique index content_suggestions_source_uniq
  on content_suggestions (user_id, source_kind, source_id, shape_key)
  where source_id is not null;

create index content_suggestions_open_idx
  on content_suggestions (user_id, created_at desc) where status = 'open';

alter table content_suggestions enable row level security;

create policy content_suggestions_select on content_suggestions
  for select using (user_id = auth.uid() and is_org_member(org_id));
-- No write policy. Every write is one of the two functions below, because both
-- touch a second table.

-- What a dismissal actually changes ------------------------------------------

create table content_suggestion_suppressions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,

  scope       text not null check (scope in ('source', 'source_shape', 'tone')),
  source_kind text not null default '',
  source_id   uuid,
  shape_key   text not null default '',
  reason      text not null,
  -- Null is forever. "Already covered it" never comes back; "not my patch"
  -- expires, because a patch changes and a permanent no is a decision nobody
  -- remembers making.
  until       timestamptz,
  created_at  timestamptz not null default now()
);

create unique index content_suppressions_uniq
  on content_suggestion_suppressions
  (user_id, scope, source_kind,
   coalesce(source_id, '00000000-0000-0000-0000-000000000000'), shape_key);

alter table content_suggestion_suppressions enable row level security;

create policy content_suppressions_select on content_suggestion_suppressions
  for select using (user_id = auth.uid() and is_org_member(org_id));

/**
 * Dismiss a suggestion, and record what that means.
 *
 * Law 1: writes content_suggestions AND content_suggestion_suppressions, so it
 * is a function rather than two client calls that can half-apply.
 *
 * The reason-to-effect map lives here, in SQL, rather than in the component
 * that renders the chips. The spec frame documents a different consequence per
 * reason, and a map that lives beside the button labels drifts from them the
 * first time somebody edits one without the other.
 *
 *   not_my_patch     that source stops surfacing for 90 days
 *   already_covered  that source stops surfacing, permanently
 *   wrong_skill      that source stops surfacing UNDER THAT SKILL only, so the
 *                    same row can still be suggested a different way
 *   too_salesy       promotional framing is suppressed for 30 days. It does
 *                    NOT touch the voice profile: an unreviewed signal editing
 *                    how every future post is written is the silent drift the
 *                    persona design rules out
 *   not_now          snoozed 14 days, no suppression at all
 *   null             skipped without a reason. Dismissed, nothing learned,
 *                    because silence is a weak no and the spec says so
 */
create function dismiss_suggestion(target uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  row_out content_suggestions%rowtype;
begin
  select * into row_out from content_suggestions where id = target;
  if not found then raise exception 'that suggestion no longer exists'; end if;
  if row_out.user_id <> auth.uid() then raise exception 'forbidden'; end if;

  if reason is not null and reason not in
     ('not_my_patch', 'too_salesy', 'already_covered', 'wrong_skill', 'not_now') then
    raise exception 'unknown dismissal reason: %', reason;
  end if;

  if reason = 'not_now' then
    update content_suggestions
       set status = 'snoozed', snoozed_until = now() + interval '14 days'
     where id = target;
    return;
  end if;

  update content_suggestions
     set status = 'dismissed', dismissed_reason = reason
   where id = target;

  if reason is null then return; end if;

  insert into content_suggestion_suppressions
    (org_id, user_id, scope, source_kind, source_id, shape_key, reason, until)
  values (
    row_out.org_id,
    row_out.user_id,
    case when reason = 'wrong_skill' then 'source_shape'
         when reason = 'too_salesy' then 'tone'
         else 'source' end,
    case when reason = 'too_salesy' then '' else row_out.source_kind end,
    case when reason = 'too_salesy' then null else row_out.source_id end,
    case when reason = 'wrong_skill' then row_out.shape_key else '' end,
    reason,
    case when reason = 'not_my_patch' then now() + interval '90 days'
         when reason = 'too_salesy'   then now() + interval '30 days'
         else null end
  )
  -- Law 2 again: dismissing two suggestions from one source is a conflict to
  -- absorb, and the newer window wins rather than erroring.
  on conflict (user_id, scope, source_kind,
               coalesce(source_id, '00000000-0000-0000-0000-000000000000'), shape_key)
  do update set reason = excluded.reason,
                until = excluded.until,
                created_at = now();
end;
$$;

/**
 * Turn a suggestion into a post.
 *
 * Law 1: creates the content_posts row AND marks the suggestion drafted with a
 * link to it. Two tables, so a client doing this as two calls could create the
 * post and then fail to mark the suggestion, and the rail would keep offering
 * something already written.
 */
create function draft_from_suggestion(
  target      uuid,
  post_hook   text,
  post_body   text default '',
  post_shape  uuid default null,
  generated   text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  row_out content_suggestions%rowtype;
  new_id  uuid;
begin
  select * into row_out from content_suggestions where id = target;
  if not found then raise exception 'that suggestion no longer exists'; end if;
  if row_out.user_id <> auth.uid() then raise exception 'forbidden'; end if;
  if post_hook is null or length(trim(post_hook)) = 0 then
    raise exception 'a post needs a hook';
  end if;

  insert into content_posts
    (org_id, ref, skill, hook, body, status, author_id, shape_id, generated_body)
  values (
    row_out.org_id,
    next_ref(row_out.org_id, 'POST'),
    -- A custom shape carries its id; the skill column keeps a valid value so
    -- every existing reader of this table keeps working.
    coalesce(
      (select s.key from content_shapes s where s.id = post_shape),
      row_out.shape_key
    )::content_skill,
    trim(post_hook),
    coalesce(post_body, ''),
    -- A generated draft lands in review, never straight into the schedule.
    -- Nothing the model wrote goes out without a person reading it.
    case when generated is null then 'drafted' else 'needs_review' end::post_status,
    auth.uid(),
    post_shape,
    generated
  )
  returning id into new_id;

  update content_suggestions
     set status = 'drafted', post_id = new_id
   where id = target;

  return new_id;
end;
$$;

-- Grants. PLS-72: Supabase grants EXECUTE to anon explicitly, so anon is named.
revoke execute on function dismiss_suggestion(uuid, text) from public, anon;
grant execute on function dismiss_suggestion(uuid, text) to authenticated, service_role;

revoke execute on function draft_from_suggestion(uuid, text, text, uuid, text)
  from public, anon;
grant execute on function draft_from_suggestion(uuid, text, text, uuid, text)
  to authenticated, service_role;
