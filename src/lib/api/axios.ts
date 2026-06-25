import axios from "axios";

import { useAuthStore } from "@/store/authStore";

const API_BASE_URL = "/api/mb";
const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      !isAuthDisabled &&
      error.response &&
      (error.response.status === 401 || error.response.status === 403)
    ) {
      void fetch("/api/auth/logout", {
        method: "POST",
      });
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
