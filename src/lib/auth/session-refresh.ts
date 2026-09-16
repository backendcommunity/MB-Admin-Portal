'use client';

/**
 * One in-flight refresh at a time, shared by every caller.
 *
 * The refresh token ROTATES on every use, and academy treats a replayed
 * (already-rotated) token as theft: it revokes the whole token family and the
 * admin is logged out for real. A dashboard fires many requests at once, so
 * when a session expires they all 401 together — without this latch that is
 * one rotation per request, five of them replays, and a hard logout every
 * time a session lapses. The latch clears once settled, so this is a
 * concurrency guard, not a one-refresh-per-page cap.
 */
let inFlight: Promise<boolean> | null = null;

/** Test seam: clears the latch between cases. */
export function __resetRefreshStateForTests() {
  inFlight = null;
}

/**
 * Asks the portal's own refresh route to mint a new access token from the
 * refresh cookie. Resolves true when the session is good again, false when
 * the caller should send the user to log in. Never throws — a refresh failing
 * is an expected outcome, not an exception.
 */
export function refreshSession(): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
