-- PLS-134. Two post states the content redesign needs, added alone.
--
-- This migration contains nothing else, and that is the whole point. Postgres
-- will not let an enum value be added and then used in the same transaction, so
-- a file that adds `needs_review` and then writes a constraint or a function
-- mentioning it fails on apply. Precedent is
-- 20260803140000_post_status_publishing_failed.sql, which added `publishing`
-- and `failed` for exactly this reason and left the columns and RPCs to the
-- migration after it. PLS-135 is that migration here.
--
-- What the two values mean, since the names are close:
--
--   needs_review     a human has to look at this before it goes out. The
--                    Figma board makes it a column, and a generated draft
--                    lands here rather than in `drafted`.
--
--   needs_attention  Pulse could not send this and nobody has fixed it yet.
--                    Distinct from `failed` on purpose: `failed` means
--                    LinkedIn refused the post, which is about the post.
--                    `needs_attention` means we never got to ask, usually
--                    because the account disconnected, which is about the
--                    account and is actionable. The spec frame is explicit:
--                    "the state goes to Needs attention with the reason, never
--                    to Failed. Failed tells the user nothing they can act on."
--
-- `if not exists` so a re-run is a no-op rather than an error.

alter type post_status add value if not exists 'needs_review';
alter type post_status add value if not exists 'needs_attention';
