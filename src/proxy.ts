import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session on every request and bounces anonymous
 * traffic to /login.
 *
 * `proxy.ts` is the Next 16 replacement for `middleware.ts` — same API, new
 * file and export name.
 *
 * Deliberately does NOT check permissions. The Next docs are explicit that
 * proxy is for optimistic redirects, not authorization, and that is exactly
 * the split here: per-feature gates live in the route layouts (which already
 * load the profile for the nav, so no extra round trip), and RLS is the actual
 * enforcement. This file only decides whether to show someone a login page.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims() verifies the JWT signature rather than asking the Auth server
  // to, so on a project with asymmetric signing keys this costs no network
  // round trip at all — and this runs on every request. It still refreshes an
  // expiring session, because it calls getSession() internally, which is the
  // reason this proxy exists.
  //
  // Do NOT swap this for getSession() alone: that trusts whatever the cookie
  // claims without verifying the signature.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub;

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/tracker";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and images. The negative lookahead keeps
     * the auth round trip off the critical path for files that never need it.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
