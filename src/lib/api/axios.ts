import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { refreshSession } from '@/lib/auth/session-refresh';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = '/api/mb';
const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Marks a config as already replayed, so one retry never becomes a loop. */
type RetriedConfig = InternalAxiosRequestConfig & { __sessionRetried?: boolean };

function toLogin() {
  if (typeof window === 'undefined') return;
  const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/login?returnUrl=${returnUrl}`);
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // 403 means the session is fine but the caller isn't permitted to do this
    // one thing; logging them out would be wrong (and would bury the real
    // error, e.g. an instructor hitting a staff-only field, behind a login
    // redirect). Only 401 is about the session.
    if (isAuthDisabled || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const config = error.config as RetriedConfig | undefined;

    // `mb_token` expires after an hour, so a 401 is usually just an expired
    // access token rather than the end of the session — the refresh token
    // covers 14 days. Renew and replay the call, and the user never sees it.
    //
    // Not retried: a request with no config to replay, one already replayed
    // once (a token that refreshes but still 401s would otherwise loop), and
    // the refresh call itself.
    const canRetry =
      Boolean(config) && !config?.__sessionRetried && !config?.url?.includes('/auth/refresh');

    if (canRetry && (await refreshSession())) {
      const retried = config as RetriedConfig;
      retried.__sessionRetried = true;
      return axiosInstance.request(retried);
    }

    // Out of options: the session is genuinely over.
    void fetch('/api/auth/logout', { method: 'POST' });
    useAuthStore.getState().logout();
    toLogin();

    return Promise.reject(error);
  },
);
