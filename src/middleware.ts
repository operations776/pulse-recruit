import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session on every request and gates the app routes.
// Auth is checked here AND enforced by RLS in the database, because a
// middleware redirect is a convenience, not a security boundary.
const PUBLIC_PATHS = ["/", "/signin", "/signup", "/auth"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // /signup?step=workspace is the one signed in state that belongs on an auth
  // route: requireSession sends a user with no org there, so bouncing them to
  // /pipeline would put them in a redirect loop.
  const finishingWorkspace =
    pathname === "/signup" &&
    request.nextUrl.searchParams.get("step") === "workspace";

  if (
    user &&
    !finishingWorkspace &&
    (pathname === "/signin" || pathname === "/signup")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/pipeline";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)).*)"],
};
