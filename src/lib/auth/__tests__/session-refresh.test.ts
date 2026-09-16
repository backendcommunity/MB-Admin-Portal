import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { readSetCookie } from '@/lib/auth/upstream-cookies';
import { refreshSession, __resetRefreshStateForTests } from '@/lib/auth/session-refresh';

describe('readSetCookie', () => {
  function headers(...cookies: string[]) {
    const h = new Headers();
    cookies.forEach((cookie) => h.append('set-cookie', cookie));
    return h;
  }

  it('pulls one cookie value out of several Set-Cookie headers', () => {
    const h = headers(
      'mb_token=access-abc; Path=/; HttpOnly',
      'mb_refresh_token=refresh-xyz; Path=/; HttpOnly; Secure',
    );
    expect(readSetCookie(h, 'mb_token')).toBe('access-abc');
    expect(readSetCookie(h, 'mb_refresh_token')).toBe('refresh-xyz');
  });

  it('returns null when the cookie is not there', () => {
    expect(readSetCookie(headers('other=1'), 'mb_token')).toBeNull();
  });

  it('does not match a cookie whose name merely ends with the one asked for', () => {
    // `mb_refresh_token` must never be read as `mb_token`.
    expect(readSetCookie(headers('mb_refresh_token=r; Path=/'), 'mb_token')).toBeNull();
  });

  it('treats a cleared cookie as absent rather than as an empty session', () => {
    const h = headers('mb_token=; Path=/; Max-Age=0');
    expect(readSetCookie(h, 'mb_token')).toBeNull();
  });

  it('survives a value containing an equals sign', () => {
    expect(readSetCookie(headers('mb_token=a.b=c; Path=/'), 'mb_token')).toBe('a.b=c');
  });
});

describe('refreshSession', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    __resetRefreshStateForTests();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the refresh route and reports success', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await expect(refreshSession()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/refresh',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('reports failure when the refresh route rejects', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    await expect(refreshSession()).resolves.toBe(false);
  });

  it('reports failure rather than throwing when the network is down', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(refreshSession()).resolves.toBe(false);
  });

  it('collapses concurrent callers into ONE refresh', async () => {
    let release: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    // Six parallel API calls all 401 at once. The refresh token rotates on
    // every use and a replayed one is treated as theft (the server revokes
    // the whole family), so six refreshes would log the admin out hard —
    // exactly the failure this dedupe exists to prevent.
    const all = Promise.all([
      refreshSession(),
      refreshSession(),
      refreshSession(),
      refreshSession(),
      refreshSession(),
      refreshSession(),
    ]);

    release({ ok: true });
    const results = await all;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual([true, true, true, true, true, true]);
  });

  it('allows a later, separate refresh once the first has settled', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await refreshSession();
    await refreshSession();

    // The single-flight latch must not become a one-refresh-per-page-load cap.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not latch a failure either — a later attempt may still succeed', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    fetchMock.mockResolvedValueOnce({ ok: true });

    await expect(refreshSession()).resolves.toBe(false);
    await expect(refreshSession()).resolves.toBe(true);
  });
});
