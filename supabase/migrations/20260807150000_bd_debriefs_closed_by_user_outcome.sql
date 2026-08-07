-- PLS-140. "Done" on the ledger was writing 'went_well'.
--
-- The whole justification for the four-outcome debrief card is that asking
-- "did you do it" with two answers makes people lie. The ledger then shipped
-- exactly that binary, and recorded every close as "it went well" into the
-- same column the debrief fills. Any coaching signal derived from
-- bd_debriefs.outcome is contaminated by clicks that meant "take this off my
-- list", not "this went well".
--
-- A fifth outcome, so the two acts stay distinguishable. It closes the
-- commitment like 'went_well' does, but it never claims an outcome the user
-- did not give, and analytics can exclude it.
alter table bd_debriefs drop constraint bd_debriefs_outcome;

alter table bd_debriefs add constraint bd_debriefs_outcome check (
  outcome in ('went_well', 'still_chasing', 'dead_end', 'skipped', 'closed_by_user')
);

-- settle_commitment maps outcome to the commitment's next status. Without this
-- arm 'closed_by_user' falls to the else branch and leaves the row open, so
-- the click would animate the row away and the promise would come straight
-- back on the next load.
create or replace function settle_commitment(
  target_commitment uuid,
  debrief_outcome text,
  debrief_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  row_org uuid;
  row_user uuid;
  next_status text;
begin
  select org_id, user_id into row_org, row_user
    from bd_commitments
   where id = target_commitment;

  if row_org is null then
    raise exception 'that commitment no longer exists';
  end if;
  if row_user <> auth.uid() or not is_org_member(row_org) then
    raise exception 'forbidden';
  end if;

  next_status := case debrief_outcome
    when 'went_well' then 'done'
    when 'closed_by_user' then 'done'
    when 'dead_end' then 'dropped'
    else 'open'
  end;

  insert into bd_debriefs (org_id, user_id, commitment_id, outcome, note)
  values (row_org, row_user, target_commitment, debrief_outcome, coalesce(debrief_note, ''))
  on conflict (commitment_id, asked_on)
  do update set outcome = excluded.outcome, note = excluded.note;

  update bd_commitments
     set status = next_status,
         settled_at = case when next_status = 'open' then null else now() end
   where id = target_commitment;

  return jsonb_build_object('status', next_status);
end;
$$;

revoke execute on function settle_commitment(uuid, text, text) from public, anon;
grant execute on function settle_commitment(uuid, text, text) to authenticated;
