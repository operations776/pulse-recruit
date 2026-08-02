# Deploying Pulse

Target: Vercel, project region London to sit next to the database.

## Before the first deploy

1. Create the Vercel project pointing at this repo, root directory `pulse/app`.
2. Set the environment variables from the ARCHITECTURE.md table. There are
   three, and only three:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://zlnctqlabowdaahnvheo.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key from Supabase, Settings, API |
   | `NEXT_PUBLIC_SITE_URL` | the deployed origin, once known |

   No service-role key. Nothing in the app uses one, and adding it would create
   a bypass around RLS with no caller.

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
