'use client';

import { useState } from 'react';

/**
 * Form state that re-seeds when the thing being edited changes.
 *
 * A dialog reused for "new" and for editing several different rows has to
 * refill its inputs when the subject changes, and the obvious way — a
 * `useEffect` that calls `setState` — is a cascading render that React (and the
 * lint rule) rejects. This is the documented alternative: adjust state during
 * render, guarded by a key.
 *
 * `key` should identify the subject: usually the row's id, or a sentinel like
 * `'new'` / `'closed'`. `build` is only called when the key changes.
 */
export function useSeededForm<T>(key: string, build: () => T) {
  const [state, setState] = useState<T>(build);
  const [seed, setSeed] = useState(key);

  if (seed !== key) {
    setSeed(key);
    setState(build());
  }

  return [state, setState] as const;
}
