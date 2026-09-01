/**
 * Regression: the response interceptor used to treat 401 and 403 identically
 * — both logged the user out and hard-redirected to /login. 403 means
 * "authenticated but not permitted" (e.g. an instructor hitting a
 * staff-only pricing field), not "your session is gone." Logging them out
 * on every 403 was why "creating a project logs me out" and buried every
 * other permission error behind a login redirect.
 *
 * Only 401 should clear the session and redirect; 403 must just reject so
 * the caller can surface the actual message.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/store/authStore';

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

const replaceMock = vi.fn();
Object.defineProperty(window, 'location', {
  value: { ...window.location, replace: replaceMock, pathname: '/projects', search: '' },
  writable: true,
});

import { axiosInstance } from '../axios';

// axios doesn't expose a public API to invoke a registered interceptor
// directly, but it stores them on `interceptors.response.handlers`.
function getRejectedHandler() {
  const handlers = (
    axiosInstance.interceptors.response as unknown as {
      handlers: Array<{ rejected: (error: unknown) => Promise<unknown> }>;
    }
  ).handlers;
  return handlers[handlers.length - 1].rejected;
}

function makeError(status: number) {
  return { response: { status }, message: `request failed with ${status}` };
}

describe('axios response interceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: 'abc', userRole: 'INSTRUCTOR', authResolved: true });
  });

  it('logs out and redirects to /login on 401', async () => {
    const rejected = getRejectedHandler();

    await expect(rejected(makeError(401))).rejects.toBeTruthy();

    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    expect(useAuthStore.getState().token).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('/login'));
  });

  it('does not log out or redirect on 403, and rejects with the original error', async () => {
    const rejected = getRejectedHandler();
    const error = makeError(403);

    await expect(rejected(error)).rejects.toBe(error);

    expect(fetch).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBe('abc');
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
