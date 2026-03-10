import { NextRequest, NextResponse } from "next/server";

function getRoleTarget(role: string) {
  if (role === "pm") return "/dashboard/pm";
  if (role === "helper") return "/portal/helper";
  return null;
}

function isAuthPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/login/pm" ||
    pathname === "/helpers/login" ||
    pathname === "/helpers/signup"
  );
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const role = request.cookies.get("app_role")?.value;
  const target = role ? getRoleTarget(role) : null;

  if ((pathname === "/" || isAuthPath(pathname)) && target) {
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (pathname.startsWith("/dashboard")) {
    if (role === "pm") return NextResponse.next();
    if (role === "helper") {
      return NextResponse.redirect(new URL("/portal/helper", request.url));
    }
    return NextResponse.redirect(new URL("/login/pm", request.url));
  }

  if (pathname.startsWith("/portal")) {
    if (role === "helper") return NextResponse.next();
    if (role === "pm") {
      return NextResponse.redirect(new URL("/dashboard/pm", request.url));
    }
    return NextResponse.redirect(new URL("/helpers/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/login/pm",
    "/helpers/login",
    "/helpers/signup",
    "/dashboard/:path*",
    "/portal/:path*"
  ]
};
