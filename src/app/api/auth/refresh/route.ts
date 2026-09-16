import { NextRequest, NextResponse } from 'next/server';

import { readSetCookie } from '@/lib/auth/upstream-cookies';

const ACADEMY_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://demo.masteringbackend.com/api/v3';

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

/** Both cookies go together: a half-cleared session is a broken one. */
function clearSession(response: NextResponse) {
  response.cookies.set({ ...COOKIE_BASE, name: 'mb_token', value: '', maxAge: 0 });
  response.cookies.set({ ...COOKIE_BASE, name: 'mb_refresh_token', value: '', maxAge: 0 });
  return response;
}

/**
 * Trades the refresh cookie for a fresh access token.
 *
 * `mb_token` lives one hour; the refresh token is good for a 14-day sliding
 * window. Academy owns the hard part already (`POST /auth/refresh`): rotation,
 * reuse detection, an absolute session cap, and a check that the user has not
 * since been deleted or suspended. This route exists because those cookies are
 * set on academy's domain during a server-to-server call and have to be
 * re-issued on the portal's own.
 *
 * Storing the ROTATED refresh token is the part that must not be skipped: the
 * old one is revoked the moment it is used, and academy reads a replay of a
 * revoked token as theft and kills the whole token family. Dropping the new
 * cookie here would not mean "refresh stopped working" — it would mean the
 * next refresh logs the admin out for good.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('mb_refresh_token')?.value;

  if (!refreshToken) {
    return clearSession(
      NextResponse.json({ refreshed: false, message: 'No session to refresh' }, { status: 401 }),
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${ACADEMY_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `mb_refresh_token=${refreshToken}` },
      cache: 'no-store',
    });
  } catch {
    // The API being unreachable is not proof the session is over, so the
    // cookies stay put and the caller can try again.
    return NextResponse.json(
      { refreshed: false, message: 'Could not reach the API' },
      { status: 503 },
    );
  }

  const access = readSetCookie(upstream.headers, 'mb_token');
  const rotated = readSetCookie(upstream.headers, 'mb_refresh_token');

  if (!upstream.ok || !access) {
    const payload = (await upstream.json().catch(() => ({}))) as { message?: string };
    return clearSession(
      NextResponse.json(
        { refreshed: false, message: payload.message || 'Session expired' },
        { status: 401 },
      ),
    );
  }

  const response = NextResponse.json({ refreshed: true });
  response.cookies.set({ ...COOKIE_BASE, name: 'mb_token', value: access });
  if (rotated) {
    response.cookies.set({ ...COOKIE_BASE, name: 'mb_refresh_token', value: rotated });
  }
  return response;
}
