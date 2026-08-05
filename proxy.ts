import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLogin = req.nextUrl.pathname === "/admin/login";
  const signedIn = Boolean(req.auth?.user);

  if (!signedIn && !isLogin) {
    const url = new URL("/admin/login", req.nextUrl.origin);
    url.searchParams.set("next", req.nextUrl.pathname);
    return Response.redirect(url);
  }

  if (signedIn && isLogin) {
    return Response.redirect(new URL("/admin", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/admin/:path*"],
};