-- PLS-87, part one of two.
--
-- Law 3 says claim before an irreversible side effect. Publishing to LinkedIn
-- is about as irreversible as this product gets, and today there is no state
-- to claim INTO: post_status is idea, drafted, scheduled, published, and the
-- content_posts_published_needs_time constraint forces published_at the
-- instant status flips, so 'published' cannot double as an in-flight marker.
--
-- 'publishing' is that marker. 'failed' is where a post lands when Unipile
-- refuses it, so the calendar can say what actually happened rather than
-- silently leaving it scheduled forever.
--
-- Own migration because Postgres will not let a new enum value be added and
-- used in the same transaction.
--
-- Mirror of the migration applied via the Supabase MCP, per law 10.
alter type post_status add value if not exists 'publishing';
alter type post_status add value if not exists 'failed';
