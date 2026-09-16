/**
 * The edge middleware is the first gate. It cannot verify a JWT (no secret at
 * the edge), so it only asks whether the browser carries a session at all.
 *
 * `mb_token` is a session cookie and dies when the browser closes; the refresh
 * cookie outlives it when the admin ticked "remember me". Gating on the access
 * cookie alone therefore threw away every remembered session at the first
 * browser restart, before the client ever got a chance to refresh.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from '../../../../middleware';

function request(path: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(`http://localhost:3000${path}`));
  Object.entries(cookies).forEach(([name, value]) => req.cookies.set(name, value));
  return req;
}

const redirectedTo = (res: Response) => res.headers.get('location');

describe('middleware session gate', () => {
  it('lets a request with an access token through', () => {
    const res = middleware(request('/courses', { mb_token: 'access' }));
    expect(redirectedTo(res)).toBeNull();
  });

  it('lets a remembered session through on nothing but a refresh cookie', () => {
    // The access cookie died with the browser. The client bootstrap will trade
    // the refresh cookie for a new one — bouncing here would make "remember
    // me" mean nothing.
    const res = middleware(request('/courses', { mb_refresh_token: 'refresh' }));
    expect(redirectedTo(res)).toBeNull();
  });

  it('redirects to login when the browser carries no session at all', () => {
    const res = middleware(request('/courses'));
    expect(redirectedTo(res)).toContain('/login');
    expect(redirectedTo(res)).toContain(`returnUrl=${encodeURIComponent('/courses')}`);
  });

  it('keeps the query string in the return url', () => {
    const res = middleware(request('/courses?tab=items'));
    expect(redirectedTo(res)).toContain(encodeURIComponent('/courses?tab=items'));
  });

  it('never gates a public route', () => {
    expect(redirectedTo(middleware(request('/login')))).toBeNull();
    expect(redirectedTo(middleware(request('/403')))).toBeNull();
  });
});
