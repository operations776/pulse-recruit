-- PLS-81, part two. Voice, shapes, and the record of what the persona learned.
--
-- The shape of this is the decision Daniyal made before the build: a persona
-- and a shape are two different things. One persona per person, because a
-- recruiter has one voice. Many shapes, because a role post and a personal
-- story do different jobs. Generation is persona plus shape, which is why they
-- are separate tables rather than one "skill" that tries to be both.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.

-- 1. The persona ---------------------------------------------------------------

create table content_personas (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,

  -- Pasted, never scraped. Exa reads cache-first public pages truncated to
  -- 2400 characters and cannot sign in to LinkedIn, so a scrape would quietly
  -- build a weak persona and the user would only find out when their posts
  -- sounded generic. Asking is honest and takes a minute.
  headline   text not null default '',
  about      text not null default '',

  -- Three they were proud of, three that flopped. The contrast is the signal:
  -- what someone rejects defines a voice as much as what they like.
  proud_posts text[] not null default '{}',
  flop_posts  text[] not null default '{}',

  -- The distilled voice the generator actually reads: tone, rhythm, opening
  -- habits, banned phrases, recurring proof. Jsonb because its shape will move
  -- as we learn what generation needs, and a migration per adjustment would
  -- make that expensive.
  voice_profile jsonb not null default '{}',

  built_at   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One voice per person. The unique index is the guard, not a check-then-insert.
create unique index content_personas_user_uniq on content_personas (user_id);
create index content_personas_org_idx on content_personas (org_id);

create trigger content_personas_touch
  before update on content_personas
  for each row execute function touch_updated_at();

alter table content_personas enable row level security;

-- Everyone in the org can see that a teammate has a persona, because the
-- planner shows whose posts are whose. Only its owner can write it: a voice is
-- not something an admin should be able to edit on someone's behalf.
create policy personas_select on content_personas
  for select using (is_org_member(org_id));
create policy personas_own_write on content_personas
  for all using (user_id = auth.uid() and is_org_member(org_id))
  with check (user_id = auth.uid() and is_org_member(org_id));

-- 2. What the persona learned ---------------------------------------------------

create table persona_lessons (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  persona_id uuid not null references content_personas(id) on delete cascade,
  post_id    uuid references content_posts(id) on delete set null,

  -- What was generated, what was published, and the one line distilled from
  -- the difference.
  generated  text not null,
  published  text not null,
  lesson     text not null,

  -- Null until the user reviews it and folds it in. A persona that changed
  -- itself silently is one nobody can trust when the posts start drifting.
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create index persona_lessons_pending_idx
    on persona_lessons (persona_id, created_at desc)
 where applied_at is null;

alter table persona_lessons enable row level security;

create policy lessons_select on persona_lessons
  for select using (is_org_member(org_id));
create policy lessons_own_write on persona_lessons
  for all using (
    is_org_member(org_id)
    and exists (
      select 1 from content_personas p
      where p.id = persona_id and p.user_id = auth.uid()
    )
  )
  with check (
    is_org_member(org_id)
    and exists (
      select 1 from content_personas p
      where p.id = persona_id and p.user_id = auth.uid()
    )
  );

-- 3. Shapes an org can add ------------------------------------------------------

create table content_shapes (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  key        text not null,
  name       text not null,
  blurb      text not null default '',
  prompt     text not null,
  created_by uuid references auth.users(id) on delete set null,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

-- The key is how a post points at its shape, so it cannot repeat inside an org.
create unique index content_shapes_key_uniq on content_shapes (org_id, key);

alter table content_shapes enable row level security;

create policy shapes_select on content_shapes
  for select using (is_org_member(org_id));
create policy shapes_write on content_shapes
  for all using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- 4. content_posts learns where its words came from ------------------------------

-- The five built-in shapes stay in code and content_posts.skill keeps working
-- untouched. A custom shape sets shape_id instead, and the reader coalesces
-- the two. Nothing existing breaks.
alter table content_posts
  add column shape_id uuid references content_shapes(id) on delete set null,
  -- The body as generated, kept so a later edit can be diffed against it.
  -- Null means a human wrote this post from scratch and there is nothing to
  -- learn from.
  add column generated_body text;
