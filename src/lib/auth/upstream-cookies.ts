/**
 * Reads one cookie value out of an upstream response's `Set-Cookie` headers.
 *
 * Academy issues `mb_token` and `mb_refresh_token` as real cookies on its own
 * response. The portal talks to it server-to-server, so those cookies never
 * reach the browser on their own — this is how the proxy routes lift a value
 * back out to re-set it on the portal's own domain.
 */
/**
 * Every Set-Cookie header, one per entry.
 *
 * `getSetCookie()` is the correct API and exists on the Node runtime the
 * route handlers run on — but NOT on every `Headers` implementation (jsdom's
 * lacks it). Falling back to an empty list there would silently drop the
 * session cookie instead of failing, so `get()` is parsed as a fallback: it
 * joins repeated headers with commas, and a cookie's own `Expires` date
 * contains a comma too, so the split only fires on a comma that begins a new
 * `name=` pair.
 */
function setCookieList(headers: Headers): string[] {
  if (typeof headers.getSetCookie === 'function') {
    const list = headers.getSetCookie();
    if (list.length) return list;
  }

  const raw = headers.get('set-cookie');
  if (!raw) return [];
  return raw.split(/,(?=\s*[^;,=\s]+=)/);
}

export function readSetCookie(headers: Headers, name: string): string | null {
  for (const cookie of setCookieList(headers)) {
    const [pair] = cookie.split(';');
    const separator = pair.indexOf('=');
    if (separator === -1) continue;

    // Exact name match: `mb_refresh_token` must never satisfy a read of
    // `mb_token`.
    if (pair.slice(0, separator).trim() !== name) continue;

    const value = pair.slice(separator + 1).trim();
    // An empty value is a deletion (`Max-Age=0`), not a session.
    return value === '' ? null : value;
  }

  return null;
}
