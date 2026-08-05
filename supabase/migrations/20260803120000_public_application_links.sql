-- PLS-78. A public application link per job.
--
-- A job mints a slug; /apply/<slug> is a form outside auth; a submission
-- lands on the job's first stage with source 'application'. The slug is the
-- capability: unguessable, revocable by nulling it, and the only thing the
-- anonymous caller ever holds.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.

alter table jobs add column application_slug text;
create unique index jobs_application_slug_uniq
    on jobs (application_slug) where application_slug is not null;

-- What the public form is allowed to know about the job it is applying to.
-- A view instead of a policy on jobs, because anon must never be able to read
-- the jobs table itself, only resolve one slug it already knows.
create function job_for_application(slug text)
returns table (job_title text, company_name text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select j.title, coalesce(c.name, '')
    from jobs j
    left join companies c on c.id = j.company_id
   where j.application_slug = slug
     and j.state = 'open';
$$;

-- The application write. DELIBERATELY callable by anon: an applicant has no
-- session, and the slug is the authorisation. Everything about it is shaped by
-- that fact: inputs are length-capped, nothing is returned beyond a boolean,
-- the row lands with no privileges attached, and a repeat application is an
-- idempotent success rather than an error that leaks who already applied.
create function apply_to_job(
  slug text,
  applicant_name text,
  applicant_email text,
  applicant_phone text default '',
  applicant_title text default '',
  applicant_company text default '',
  applicant_linkedin text default ''
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  job_row jobs%rowtype;
  first_stage uuid;
  new_id uuid;
begin
  if length(trim(applicant_name)) = 0 then raise exception 'a name is required'; end if;
  if applicant_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'a valid email is required';
  end if;
  if length(applicant_name) > 200 or length(applicant_email) > 200
     or length(applicant_phone) > 50 or length(applicant_title) > 200
     or length(applicant_company) > 200 or length(applicant_linkedin) > 300 then
    raise exception 'a field is too long';
  end if;

  select * into job_row from jobs
   where application_slug = slug and state = 'open';
  if not found then raise exception 'this role is not taking applications'; end if;

  select id into first_stage from stages
   where job_id = job_row.id order by position limit 1;
  if first_stage is null then raise exception 'this role is not taking applications'; end if;

  insert into candidates
    (org_id, ref, job_id, stage_id, name, email, phone, title, company_name,
     linkedin_url, source, match, last_activity_at)
  values
    (job_row.org_id, next_ref(job_row.org_id, 'CAND'), job_row.id, first_stage,
     trim(applicant_name), lower(trim(applicant_email)), trim(applicant_phone),
     trim(applicant_title), trim(applicant_company), trim(applicant_linkedin),
     'application', 0, now())
  on conflict (job_id, lower(email)) where email <> ''
  do nothing
  returning id into new_id;

  -- A repeat application collides on the unique index and inserts nothing.
  -- That is success from the applicant's side, and staying silent about the
  -- difference is the point: an error here would tell a stranger which emails
  -- are already in the pipeline.
  if new_id is not null then
    insert into activity_events (org_id, candidate_id, kind, summary, actor_id)
    values (job_row.org_id, new_id, 'created',
            'Applied through the public link', null);
  end if;

  return true;
end;
$$;

revoke all on function job_for_application(text) from public;
grant execute on function job_for_application(text) to anon, authenticated, service_role;

revoke all on function apply_to_job(text, text, text, text, text, text, text) from public;
grant execute on function apply_to_job(text, text, text, text, text, text, text)
  to anon, authenticated, service_role;
