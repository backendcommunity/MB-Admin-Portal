/**
 * The session bootstrap. `mb_token` lives one hour, so this runs into an
 * expired session constantly — and what it does then is the whole bug this
 * file exists to pin.
 *
 * Before: it called `setUserRole(null)` on any failure, which sets
 * `authResolved: true`, which made `useRoleGuard` send the admin to /403.
 * "Forbidden" is the wrong story: they are not barred from the page, their
 * session ran out. /403 is also a dead end — it offers no way back in.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';

import AuthSessionHydrator from '@/components/shared/AuthSessionHydrator';
import { useAuthStore } from '@/store/authStore';
import { __resetRefreshStateForTests } from '@/lib/auth/session-refresh';

const replace = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
  __resetRefreshStateForTests();
  useAuthStore.setState({ userRole: null, authResolved: false });

  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/courses', search: '', replace },
  });
});

function mockFetch(handler: (url: string) => unknown) {
  const spy = vi.fn((input: RequestInfo | URL) => Promise.resolve(handler(String(input))));
  vi.stubGlobal('fetch', spy);
  return spy;
}

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const unauthorized = () => ({ ok: false, status: 401, json: async () => ({}) });

describe('AuthSessionHydrator', () => {
  it('sets the role when the session is good', async () => {
    mockFetch(() => ok({ authenticated: true, role: 'ADMIN' }));
    render(<AuthSessionHydrator />);

    await waitFor(() => expect(useAuthStore.getState().userRole).toBe('ADMIN'));
    expect(replace).not.toHaveBeenCalled();
  });

  it('refreshes an expired session and carries on without bothering the user', async () => {
    let meCalls = 0;
    const fetchSpy = mockFetch((url) => {
      if (url.includes('/api/auth/refresh')) return ok({ refreshed: true });
      meCalls += 1;
      return meCalls === 1 ? unauthorized() : ok({ authenticated: true, role: 'ADMIN' });
    });

    render(<AuthSessionHydrator />);

    await waitFor(() => expect(useAuthStore.getState().userRole).toBe('ADMIN'));
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/refresh', expect.anything());
    // The whole point: an hourly token expiry is invisible.
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends the user to log in — never to /403 — when the refresh fails', async () => {
    mockFetch((url) => (url.includes('/api/auth/refresh') ? unauthorized() : unauthorized()));

    render(<AuthSessionHydrator />);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(replace.mock.calls[0][0]).toContain('/login');
    expect(replace.mock.calls[0][0]).not.toContain('/403');
  });

  it('brings the user back to the page they were on after logging in', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/courses/abc', search: '?tab=items', replace },
    });
    mockFetch(() => unauthorized());

    render(<AuthSessionHydrator />);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(replace.mock.calls[0][0]).toBe(
      `/login?returnUrl=${encodeURIComponent('/courses/abc?tab=items')}`,
    );
  });

  it('does not resolve auth on the way out, so no /403 flashes mid-redirect', async () => {
    mockFetch(() => unauthorized());

    render(<AuthSessionHydrator />);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    // `authResolved` true with a null role is exactly what useRoleGuard reads
    // as "known, and not allowed" — it must stay false while we navigate away.
    expect(useAuthStore.getState().authResolved).toBe(false);
  });

  it('still reports a real user who simply has no portal role, so /403 keeps working', async () => {
    mockFetch(() => ok({ authenticated: true, role: null }));

    render(<AuthSessionHydrator />);

    await waitFor(() => expect(useAuthStore.getState().authResolved).toBe(true));
    expect(useAuthStore.getState().userRole).toBeNull();
    // A signed-in non-admin IS forbidden. That redirect belongs to the guard.
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not bounce off the login page itself', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/login', search: '', replace },
    });
    mockFetch(() => unauthorized());

    render(<AuthSessionHydrator />);

    await waitFor(() => expect(useAuthStore.getState().authResolved).toBe(true));
    expect(replace).not.toHaveBeenCalled();
  });
});
