import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // API routes enforce authentication and authorization internally.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  const authPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/update-password" ||
    pathname === "/invite/accept";

  const recoveryPage = pathname === "/update-password";
  const loginOrSignupPage =
    pathname === "/login" || pathname === "/signup";

  if (!user && !authPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (loginOrSignupPage || pathname === "/forgot-password")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (recoveryPage) {
    return response;
  }

  // Enforce permissions for currently implemented protected pages.
  const requiredPermission =
    pathname === "/products" || pathname.startsWith("/products/")
      ? "products.view"
      : pathname === "/team" || pathname.startsWith("/team/")
        ? "members.view"
        : null;

  if (user && requiredPermission) {
    const { data: membership, error: membershipError } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      url.search = "";
      return NextResponse.redirect(url);
    }

    const { data: allowed, error: permissionError } = await supabase.rpc(
      "has_company_permission",
      {
        p_company_id: membership.company_id,
        p_permission: requiredPermission,
      }
    );

    if (permissionError || allowed !== true) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("access", "denied");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
