import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = new Set(['/', '/login', '/forgot-password', '/403']);

function isPublicRoute(pathname: string) {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/api/auth')) return true;
  if (pathname === '/favicon.ico') return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // The edge has no token secret, so this can only ask whether a session is
  // present at all -- validity is settled by the API, and an expired access
  // token is handled client-side by trading the refresh cookie for a new one.
  //
  // The refresh cookie counts on its own: `mb_token` is a session cookie and
  // dies when the browser closes, while a "remember me" refresh cookie
  // outlives it. Requiring the access cookie here would discard every
  // remembered session at the first browser restart.
  const token =
    request.cookies.get('mb_token')?.value || request.cookies.get('mb_refresh_token')?.value;

  if (!token) {
    const returnUrl = encodeURIComponent(`${pathname}${search}`);
    const loginUrl = new URL(`/login?returnUrl=${returnUrl}`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)).*)'],
};
