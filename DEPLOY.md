# Deploying Pulse

Target: Vercel, project region London to sit next to the database.

## Before the first deploy

1. Create the Vercel project pointing at this repo, root directory `pulse/app`.
2. Set the environment variables from the ARCHITECTURE.md table.

   Needed to boot:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://zlnctqlabowdaahnvheo.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key from Supabase, Settings, API |
   | `NEXT_PUBLIC_SITE_URL` | the deployed origin, once known |

   Needed for Pillar 5 LinkedIn posting. Leave them unset and the Channels
   screen says so plainly rather than offering a button that cannot work:

   | Name | Value |
   | --- | --- |
   | `UNIPILE_API_KEY` | from the RecruiterGTM Unipile dashboard |
   | `UNIPILE_DSN` | that tenant's API base, for example `https://api8.unipile.com:13843` |
   | `UNIPILE_WEBHOOK_SECRET` | `openssl rand -hex 32`. Changing it invalidates auth links already sent |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase, Settings, API |
   | `CRON_SECRET` | `openssl rand -hex 32`. The same value goes into the pg_cron job below |

   `NEXT_PUBLIC_SITE_URL` stops being optional once Unipile is on: the hosted
   auth link's notify and redirect URLs are built from it, and a link pointing
   at a preview deployment sends the callback to the wrong place.

   The service-role key has exactly two callers, both sessionless:
   `/api/unipile/accounts`, which Unipile posts to from its own servers, and
   `/api/cron/publish`, which pg_cron posts to and which works across every org
   at once. See the ARCHITECTURE.md note. Do not introduce a third caller
   without changing that note first.

3. In Supabase, Authentication, URL Configuration, add the Vercel origin to
   both Site URL and Redirect URLs. Auth will silently fail to return the user
   to the app otherwise.

## Deploy order

Migrations before the code that needs them, always (law 10). The schema is
already applied to the live project, so a deploy of this commit is safe. When a
future change adds a migration, apply it to Supabase first, confirm it, then
deploy.

## Turning on the publisher

Do this LAST, after a real post has been watched going out. A scheduler aimed
at unproven code publishes mistakes to a real audience once a minute.

1. Connect a LinkedIn profile in Settings, Channels.
2. Schedule a post one minute out and let it come due. Call the route by hand:

   ```bash
   curl -X POST https://<site>/api/cron/publish -H "x-cron-secret: $CRON_SECRET"
   ```

   It answers with honest counts:
   `{ claimed, published, failed, attention, flagged, swept }`. `failed` is
   LinkedIn refusing the words. `attention` is a post we could not attempt,
   usually a disconnected account, and it does not burn one of the three
   retries. `flagged` counts due posts that had no connected account to go
   through at all, which the claim query cannot see.
3. Check the post is on LinkedIn, and that its row carries `unipile_post_id`
   and `post_url`.
4. Only then schedule it, in the Supabase SQL editor. The secret is written
   into the job, so rotating `CRON_SECRET` means rescheduling the job too:

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;

   select cron.schedule('publish-due-posts', '* * * * *', $$
     select net.http_post(
       url := 'https://<site>/api/cron/publish',
       headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
     );
   $$);
   ```

   To stop it: `select cron.unschedule('publish-due-posts');`

Everything already on the calendar before PLS-87 was grandfathered to
`auto_publish = false`, so turning the cron on cannot make old drafts fire.
Anything scheduled after it goes out at its time.

## Turning on the metrics refresher

PLS-155. Separate from the publisher and far less urgent: this only reads. It
fetches engagement counters for posts Pulse published and writes `post_metrics`,
which is what the planner's performance cards and the best-slot advice are built
on. Until it runs, those surfaces correctly show nothing rather than a zero.

No new env var. It reuses `CRON_SECRET` and the same constant-time check, which
now lives in `src/lib/server/cron-auth.ts` and is shared by both routes.

1. Call it by hand first, exactly like the publisher:

   ```bash
   curl -X POST https://<site>/api/cron/post-metrics -H "x-cron-secret: $CRON_SECRET"
   ```

   It answers `{ considered, refreshed, skipped, failed }`. `skipped` is not a
   failure: it counts posts with no usable connected account to ask through, or
   a post LinkedIn no longer has. A workspace with no connected LinkedIn will
   report only skips, and that is the correct answer rather than an error.
2. Check a `post_metrics` row landed, and that unreported figures are **null**
   rather than `0`. A zero where LinkedIn said nothing is the one failure mode
   this whole table is shaped to prevent.
3. Schedule it. Six-hourly, offset off the hour so it never starts in the same
   second as the publisher:

   ```sql
   select cron.schedule('refresh-post-metrics', '17 */6 * * *', $$
     select net.http_post(
       url := 'https://<site>/api/cron/post-metrics',
       headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
     );
   $$);
   ```

   To stop it: `select cron.unschedule('refresh-post-metrics');`

## After deploy

- Sign in with the demo account and walk one write on each module. A read-only
  smoke test proves nothing about RLS.
- Run the Supabase security advisor. New tables or functions frequently arrive
  without policies or with EXECUTE granted to anon.
- Check the Vercel build log for the route list. Any route that unexpectedly
  became dynamic is usually an accidental cookie read in a shared component.

## What is not wired yet

Sending, research and model calls all require per-org keys added in Settings.
Until then the BD engine and ops manager return an honest placeholder instead
of an invented answer, and no mail leaves the system.
