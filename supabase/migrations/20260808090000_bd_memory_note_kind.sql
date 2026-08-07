-- PLS-185: the tell-drawer's freeform box files what a recruiter pastes or
-- types as kind 'note', and the BD-hours gap files as 'capacity'. Neither fits
-- the eight strategy kinds, and misfiling a pasted client email as
-- 'preference' would poison the filled-gap detection that decides which
-- questions the drawer still asks.
alter table bd_agent_memories
  drop constraint bd_agent_memories_kind;

alter table bd_agent_memories
  add constraint bd_agent_memories_kind check (
    kind in (
      'positioning', 'ideal_client', 'buyer', 'territory',
      'offer', 'qualification', 'preference', 'feedback',
      'note', 'capacity'
    )
  );
