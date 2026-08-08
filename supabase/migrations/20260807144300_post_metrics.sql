-- PLS-136. Somewhere honest to put real LinkedIn numbers.
--
-- The content redesign prints views, likes and replies on four of its six
-- frames, and ranks posting slots by them. Nothing in Pulse has ever stored
-- them: publishPost returns a post id and a URL and that is all.
--
-- EVERY COUNTER IS NULLABLE, AND THAT IS THE POINT OF THIS FILE.
--
-- A count LinkedIn did not report is null, never 0. Zero is a measurement: it
-- says "nobody liked this". Null says "we do not know". Defaulting these to 0
-- would make every unreported figure into a claim the product cannot support,
-- on a screen whose whole job is to tell a recruiter what is working. The
-- never-fabricate rule in CLAUDE.md and AI.md section 4 is not only about model
-- output; a fabricated metric is worse, because it looks like arithmetic.
--
-- Everything downstream has to be null-aware because of this: an average over
-- nulls is not zero, it is "not reported", and the components say so.
--
-- Impressions specifically. Unipile's post object carries reaction_counter,
-- comment_counter and repost_counter dependably, and impressions_counter plus a
-- fuller analytics object only for accounts that have LinkedIn analytics at
-- all. So impressions is the column most likely to stay null forever on a
-- personal profile, and nothing may substitute reactions for it.
--
-- One row per post, no time series. "Views in the first hour" is therefore
-- unbuildable without a second table. Accepted deliberately: the redesign asks
-- for totals, and a metrics history table that nothing reads is a table that
-- rots.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.

create table post_metrics (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  post_id     uuid not null references content_posts(id) on delete cascade,

  impressions integer check (impressions >= 0),
  likes       integer check (likes >= 0),
  comments    integer check (comments >= 0),
  reposts     integer check (reposts >= 0),

  -- Where the numbers came from. One value today, and a check rather than an
  -- enum: a second source is a text value here, not a migration that has to
  -- land alone before anything can use it.
  source      text not null default 'unipile' check (source in ('unipile')),

  -- When we last asked. The refresher selects by this, so it never needs a
  -- column on content_posts and the write stays one table.
  fetched_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- Law 2: the race guard is a unique constraint, and the refresher upserts on
-- it. Two cron runs overlapping is a conflict to absorb, not an error, and
-- never a check-then-insert.
create unique index post_metrics_post_uniq on post_metrics (post_id);

-- The refresher's own query: oldest first, so a backlog drains in order.
create index post_metrics_stale_idx on post_metrics (fetched_at);

-- The planner reads a workspace's recent numbers.
create index post_metrics_org_idx on post_metrics (org_id, fetched_at desc);

alter table post_metrics enable row level security;

create policy post_metrics_select on post_metrics
  for select using (is_org_member(org_id));

-- No insert or update policy, on purpose. Every write is the refresher running
-- as service_role against the Unipile API. Exactly the same shape as
-- linkedin_accounts, which has no write policy for the same reason: the only
-- writer has no session for a policy to check.
