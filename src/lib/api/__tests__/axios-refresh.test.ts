/**
 * A 401 from the API used to mean "log out and bounce to /login". With
 * `mb_token` living only an hour, that fired on any admin who left a tab open
 * through lunch. The refresh token covers a 14-day sliding window, so a 401 is
 * now a prompt to renew and retry — and only a logout once renewal fails.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const refreshSession = vi.fn();

vi.mock('@/lib/auth/session-refresh', () => ({
  refreshSession: () => refreshSession(),
  __resetRefreshStateForTests: () => {},
}));

const logout = vi.fn();
vi.mock('@/store/authStore', () => ({
  useAuthStore: { getState: () => ({ logout }) },
}));

const replace = vi.fn();

async function loadInterceptor() {
  vi.resetModules();
  const { axiosInstance } = await import('@/lib/api/axios');
  // The rejection handler axios registered, invoked directly: it is the unit
  // under test, and driving it through a real request would need a server.
  const handlers = (
    axiosInstance.interceptors.response as unknown as {
      handlers: { rejected: (error: unknown) => Promise<unknown> }[];
    }
  ).handlers;
  return { axiosInstance, onRejected: handlers[handlers.length - 1].rejected };
}

function unauthorized(url = '/admin/teams') {
  return {
    response: { status: 401 },
    config: { url, method: 'get', headers: {} },
  };
}

beforeEach(() => {
  refreshSession.mockReset();
  logout.mockReset();
  replace.mockReset();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/teams', search: '', replace },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('axios 401 handling', () => {
  it('refreshes and replays the failed request, leaving the user in place', async () => {
    refreshSession.mockResolvedValue(true);
    const { axiosInstance, onRejected } = await loadInterceptor();

    const retry = vi.fn().mockResolvedValue({ data: 'ok' });
    // The instance itself performs the replay.
    const request = vi.spyOn(axiosInstance, 'request').mockImplementation(retry);

    await expect(onRejected(unauthorized())).resolves.toEqual({ data: 'ok' });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('logs out and sends the user to login when the refresh fails', async () => {
    refreshSession.mockResolvedValue(false);
    const { onRejected } = await loadInterceptor();

    await expect(onRejected(unauthorized())).rejects.toBeTruthy();
    expect(logout).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith(`/login?returnUrl=${encodeURIComponent('/teams')}`);
  });

  it('retries a given request only once, so a still-401 replay cannot loop', async () => {
    refreshSession.mockResolvedValue(true);
    const { axiosInstance, onRejected } = await loadInterceptor();

    // The replayed call 401s again — a token that refreshes but still does not
    // authorise would otherwise refresh-and-retry forever.
    const replayed = unauthorized();
    vi.spyOn(axiosInstance, 'request').mockImplementation(async (config) => {
      throw { response: { status: 401 }, config };
    });

    await expect(onRejected(replayed)).rejects.toBeTruthy();
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('leaves a 403 alone — that is a permissions answer, not an expired session', async () => {
    const { onRejected } = await loadInterceptor();
    const forbidden = { response: { status: 403 }, config: { url: '/admin/teams', headers: {} } };

    await expect(onRejected(forbidden)).rejects.toBe(forbidden);
    expect(refreshSession).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  it('does not try to refresh when the refresh call itself is what 401d', async () => {
    const { onRejected } = await loadInterceptor();
    const failed = {
      response: { status: 401 },
      config: { url: '/api/auth/refresh', headers: {} },
    };

    await expect(onRejected(failed)).rejects.toBeTruthy();
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
