import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase session on every request and gates the app routes.
// Auth is checked here AND enforced by RLS in the database, because a
// middleware redirect is a convenience, not a security boundary.
// /apply is the public application form: an applicant holds a slug, not a
// session, and the anon-granted RPC behind it is the whole boundary.
// The marketing site is the whole point of being public: a prospect reading
// the pricing page has no session and must never be bounced to sign-in.
// PLS-107 added four pages here and they were unreachable until this list
// grew, which a screenshot caught and the build did not.
const PUBLIC_PATHS = [
  "/",
  "/signin",
  "/signup",
  "/auth",
  "/apply",
  "/features",
  "/pricing",
  "/faq",
  "/testimonials",
];

// Machine callers have no session, so the session gate would answer 401 and the
// work would silently never happen. These routes are not unprotected: each one
// verifies a shared secret it minted itself, in constant time, before it writes
// anything.
//
// /api/unipile   arrives from Unipile's servers, checks UNIPILE_WEBHOOK_SECRET
// /api/cron      arrives from pg_cron via pg_net, checks CRON_SECRET
//
// PLS-88 shipped without the second entry and the deployed publisher answered
// 401 to its own scheduler: a job that would have looked healthy in pg_cron
// while nothing was ever published. Anything sessionless added here needs its
// path in this list and a secret of its own.
const CALLBACK_PATHS = ["/api/unipile", "/api/cron"];

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
  // Every path this matches costs a getUser round trip to Supabase Auth before
  // anything renders, so the matcher is an exclusion list and every entry is
  // load-bearing.
  //
  // `_next/data` and the RSC payload requests that client-side navigation
  // fires were both being matched, which meant a single link click paid for
  // the auth check twice: once for the payload and once for the page. The
  // routes behind them still call requireSession, and RLS is the real
  // boundary underneath that, so skipping the middleware check here costs no
  // safety.
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)).*)",
  ],
};
