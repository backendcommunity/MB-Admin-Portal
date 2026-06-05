import axios from "axios";

import { useAuthStore } from "@/store/authStore";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      !isAuthDisabled &&
      error.response &&
      (error.response.status === 401 || error.response.status === 403)
    ) {
      useAuthStore.getState().logout();
      if (typeof window !== "undefined") {
        const returnUrl = encodeURIComponent(
          window.location.pathname + window.location.search
        );
        window.location.replace(`/login?returnUrl=${returnUrl}`);
      }
    }
    return Promise.reject(error);
  }
);
