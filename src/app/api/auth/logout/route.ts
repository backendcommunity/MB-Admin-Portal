import { NextRequest, NextResponse } from 'next/server';

const ACADEMY_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://demo.masteringbackend.com/api/v3';

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 0,
};

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('mb_refresh_token')?.value;

  // Tell academy first so it revokes the rotation family. Clearing the cookie
  // here only ends the session in THIS browser — the refresh token would
  // otherwise stay valid for its full 14-day window, and anyone holding a copy
  // could keep minting access tokens from it long after the admin believed
  // they had logged out. Best effort: an unreachable API must still log the
  // user out locally.
  if (refreshToken) {
    try {
      await fetch(`${ACADEMY_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Cookie: `mb_refresh_token=${refreshToken}` },
        cache: 'no-store',
      });
    } catch {
      // Swallowed on purpose — see above.
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({ ...COOKIE_BASE, name: 'mb_token', value: '' });
  response.cookies.set({ ...COOKIE_BASE, name: 'mb_refresh_token', value: '' });

  return response;
}
