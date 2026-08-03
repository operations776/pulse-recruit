-- PLS-61. Pillar 5 phase A: the content calendar.
--
-- Adds the post lifecycle the calendar needs, an assets table for media, an
-- org-prefixed storage bucket, and the one write that touches two tables.
--
-- Applied via the Supabase MCP as version 20260802172422. This file is the
-- mirror required by ARCHITECTURE.md law 10.

-- 1. content_posts gains a real lifecycle -------------------------------------

alter table content_posts
  add column published_at timestamptz,
  add column updated_at   timestamptz not null default now();

-- Backfill before the constraint below can see the rows.
update content_posts
   set published_at = coalesce(scheduled_for, created_at)
 where status = 'published' and published_at is null;

-- A scheduled post with no date, or a published post with no time, is a row the
-- calendar cannot place. Refuse it here rather than defending against it in
-- five different places in the UI.
alter table content_posts
  add constraint content_posts_scheduled_needs_date
    check (status <> 'scheduled' or scheduled_for is not null),
  add constraint content_posts_published_needs_time
    check (status <> 'published' or published_at is not null);

-- The calendar reads one month at a time, so the partial index carries it.
create index content_posts_month_idx
    on content_posts (org_id, scheduled_for)
 where scheduled_for is not null;

create or replace function touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger content_posts_touch
  before update on content_posts
  for each row execute function touch_updated_at();

-- 2. content_assets ------------------------------------------------------------

create table content_assets (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  post_id      uuid not null references content_posts(id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  mime_type    text not null default '',
  size_bytes   bigint not null default 0,
  sort         integer not null default 0,
  created_at   timestamptz not null default now()
);

-- Law 2: the unique index is the race guard. A retried upload collides here
-- instead of leaving two rows pointing at one blob.
create unique index content_assets_path_uniq on content_assets (storage_path);
create index content_assets_post_idx on content_assets (post_id, sort);

alter table content_assets enable row level security;

create policy assets_rw on content_assets
  for all
  using (is_org_member(org_id))
  with check (is_org_member(org_id));

-- 3. Storage: one private bucket, paths prefixed by org ------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-media',
  'content-media',
  false,
  209715200,
  array[
    'image/png','image/jpeg','image/gif','image/webp',
    'video/mp4','video/quicktime','video/webm',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

-- Objects live at {org_id}/{post_id}/{uuid}-{file name}. A path whose first
-- segment is not a uuid returns null rather than raising, because a cast that
-- throws inside a policy fails the whole query instead of denying one row.
create or replace function storage_org(path text)
returns uuid
language sql
immutable
set search_path = public, storage
as $$
  select case
    when (storage.foldername(path))[1] ~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(path))[1])::uuid
  end;
$$;

create policy "content media read" on storage.objects
  for select to authenticated
  using (bucket_id = 'content-media' and is_org_member(storage_org(name)));

create policy "content media insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'content-media' and is_org_member(storage_org(name)));

create policy "content media delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'content-media' and is_org_member(storage_org(name)));

-- 4. The one multi-table write --------------------------------------------------

-- Law 1: deleting a post touches content_assets and content_posts, so it is an
-- RPC. Law 4: the rows die here and the caller removes the blobs afterwards,
-- using the paths this returns. An orphan blob costs pennies; a row pointing at
-- a blob that is gone is a broken screen.
create or replace function delete_post(target_post uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_org uuid;
  paths     text[];
begin
  select org_id into owner_org from content_posts where id = target_post;
  if owner_org is null then
    raise exception 'that post no longer exists';
  end if;
  if not is_org_member(owner_org) then
    raise exception 'forbidden';
  end if;

  select coalesce(array_agg(storage_path), '{}')
    into paths
    from content_assets
   where post_id = target_post;

  delete from content_assets where post_id = target_post;
  delete from content_posts  where id = target_post;

  return paths;
end;
$$;

-- Grants follow the established split: policy predicates are callable by both
-- client roles, RPCs by authenticated only, and nothing by public.
revoke all on function storage_org(text) from public;
grant execute on function storage_org(text) to anon, authenticated, service_role;

revoke all on function delete_post(uuid) from public;
grant execute on function delete_post(uuid) to authenticated, service_role;

revoke all on function touch_updated_at() from public;
