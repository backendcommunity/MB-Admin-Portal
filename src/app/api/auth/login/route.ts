import { NextRequest, NextResponse } from 'next/server';

import { mapAcademyRoleToPortalRole } from '@/lib/auth/roleMapping';
import { readSetCookie } from '@/lib/auth/upstream-cookies';

const ACADEMY_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://demo.masteringbackend.com/api/v3';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const response = await fetch(`${ACADEMY_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: {
      token?: string;
      user?: {
        role?: string;
      };
    };
  };

  if (!response.ok) {
    return NextResponse.json(
      {
        message: payload.message || 'Invalid credentials',
      },
      {
        status: response.status,
      },
    );
  }

  const token = payload.data?.token;
  const role = mapAcademyRoleToPortalRole(payload.data?.user?.role);

  if (!token) {
    return NextResponse.json(
      {
        message: 'Login response did not include a token',
      },
      {
        status: 502,
      },
    );
  }

  const result = NextResponse.json(
    {
      success: true,
      role,
    },
    {
      status: 200,
    },
  );

  result.cookies.set({
    name: 'mb_token',
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  // Academy issues a refresh token alongside the access token, as a cookie on
  // its own response — which this server-to-server call would otherwise drop
  // on the floor. Without it the portal has no way to renew, and `mb_token`'s
  // one-hour life becomes an hourly logout despite the API supporting a
  // 14-day session.
  const refreshToken = readSetCookie(response.headers, 'mb_refresh_token');
  if (refreshToken) {
    result.cookies.set({
      name: 'mb_refresh_token',
      value: refreshToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }

  return result;
}
