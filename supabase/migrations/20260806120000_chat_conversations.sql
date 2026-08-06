-- PLS-105. Conversations: a chat surface gets threads, not one endless log.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.
--
-- The rebrand's BD Strategist has a history panel grouped Today / Yesterday /
-- 2 Aug with a "+ New conversation" button. Ours had a single transcript that
-- grew forever, which is also why getBDWorkspace had to cap itself at 60 rows.
--
-- Existing messages are adopted into one conversation per (org, surface) so
-- nothing is orphaned and no transcript appears to have been deleted.

create table chat_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  surface chat_surface not null,
  -- Named from the first question asked, so a thread is findable without
  -- anyone being made to name it.
  title text not null default 'New conversation',
  -- Who started it. A conversation is personal to the recruiter who asked,
  -- the same way a BD memory can be.
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Sorting the history panel by "when did anything last happen here" rather
  -- than by creation, which is what makes an old thread you just replied to
  -- come back to the top.
  last_message_at timestamptz not null default now()
);

create index chat_conversations_recent_idx
  on chat_conversations (org_id, surface, last_message_at desc);

alter table chat_conversations enable row level security;
revoke all on table chat_conversations from anon;
grant select, insert, update, delete on table chat_conversations to authenticated;

create policy chat_conversations_select on chat_conversations
  for select to authenticated using (is_org_member(org_id));

create policy chat_conversations_insert on chat_conversations
  for insert to authenticated with check (is_org_member(org_id));

create policy chat_conversations_update on chat_conversations
  for update to authenticated
  using (is_org_member(org_id)) with check (is_org_member(org_id));

-- Deleting a thread is deleting your own thread. An admin clearing out a
-- teammate's research history is not a thing this product should offer.
create policy chat_conversations_delete on chat_conversations
  for delete to authenticated
  using (is_org_member(org_id) and author_id = (select auth.uid()));

alter table chat_messages
  add column conversation_id uuid references chat_conversations(id) on delete cascade;

create index chat_messages_conversation_idx
  on chat_messages (conversation_id, created_at);

-- Adopt everything already written. One thread per (org, surface), titled from
-- its own first question, so no existing transcript is stranded outside the
-- new history panel.
with adopted as (
  insert into chat_conversations (org_id, surface, title, author_id, created_at, last_message_at)
  select m.org_id,
         m.surface,
         coalesce(
           (select left(m2.body, 60) from chat_messages m2
             where m2.org_id = m.org_id and m2.surface = m.surface
               and m2.role = 'user' and length(trim(m2.body)) > 0
             order by m2.created_at asc limit 1),
           'Earlier conversation'),
         (select m3.author_id from chat_messages m3
           where m3.org_id = m.org_id and m3.surface = m.surface
           order by m3.created_at asc limit 1),
         min(m.created_at),
         max(m.created_at)
    from chat_messages m
   group by m.org_id, m.surface
  returning id, org_id, surface
)
update chat_messages m
   set conversation_id = a.id
  from adopted a
 where m.org_id = a.org_id and m.surface = a.surface;
