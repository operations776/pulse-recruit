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

   `NEXT_PUBLIC_SITE_URL` stops being optional once Unipile is on: the hosted
   auth link's notify and redirect URLs are built from it, and a link pointing
   at a preview deployment sends the callback to the wrong place.

   The service-role key has exactly one caller, `/api/unipile/accounts`, which
   Unipile posts to with no user session. See the ARCHITECTURE.md note. Do not
   introduce a second caller without changing that note first.

3. In Supabase, Authentication, URL Configuration, add the Vercel origin to
   both Site URL and Redirect URLs. Auth will silently fail to return the user
   to the app otherwise.

## Deploy order

Migrations before the code that needs them, always (law 10). The schema is
already applied to the live project, so a deploy of this commit is safe. When a
future change adds a migration, apply it to Supabase first, confirm it, then
deploy.

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
