/**
 * Axios HTTP client: single instance with base URL from environment.
 * All API modules import from here, not directly from axios.
 */

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30_000,
});

// ── Response interceptor: normalise errors ─────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server returned a non-2xx response
      const data = error.response.data;
      const message =
        data?.error?.message ??
        data?.detail ??
        `Request failed with status ${error.response.status}`;
      return Promise.reject(new Error(message));
    }
    if (error.request) {
      return Promise.reject(
        new Error("No response from server. Is the backend running?")
      );
    }
    return Promise.reject(error);
  }
);

export default apiClient;

