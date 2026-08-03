import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session on every request and gates the app routes.
// Auth is checked here AND enforced by RLS in the database, because a
// middleware redirect is a convenience, not a security boundary.
const PUBLIC_PATHS = ["/", "/signin", "/signup", "/auth"];

// Provider callbacks arrive from another company's servers and have no session,
// so the session gate would answer 401 and the connection would silently never
// be recorded. These routes are not unprotected: each one verifies a shared
// secret it minted itself, in constant time, before it writes anything.
const CALLBACK_PATHS = ["/api/unipile"];

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
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    CALLBACK_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    // An API route answers with a status code. Redirecting one to /signin makes
    // it reply 405 (the sign-in page has no POST handler), which reads as a
    // broken endpoint rather than an unauthenticated one.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    }

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
