import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Server client, carries the user session from cookies. Every read through this
// is RLS constrained, so a missing policy shows up as empty data rather than a
// leak.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read only.
            // Middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
