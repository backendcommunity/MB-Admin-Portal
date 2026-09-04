import axios from 'axios';

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

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 means the session itself is gone — clear it and send the user to
    // log in again. 403 means the session is fine but the caller isn't
    // permitted to do this one thing; logging them out would be wrong (and
    // would bury the real error, e.g. an instructor hitting a staff-only
    // field, behind a login redirect).
    if (!isAuthDisabled && error.response && error.response.status === 401) {
      void fetch('/api/auth/logout', {
        method: 'POST',
      });
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`/login?returnUrl=${returnUrl}`);
      }
    }
    return Promise.reject(error);
  },
);
