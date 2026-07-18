import axios from 'axios';

/**
 * Axios instance for the API.
 *
 * The access token lives in memory only (never localStorage), so an XSS payload
 * cannot exfiltrate a persisted token. Session continuity across reloads comes
 * from the HTTP-only refresh cookie plus a silent /auth/refresh on boot.
 */
const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL,
  withCredentials: true, // send the refresh cookie
  headers: { 'Content-Type': 'application/json' },
});

let accessToken = null;
let onSessionExpired = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/** Registered by the auth provider so a failed refresh can clear app state. */
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// --- Silent refresh on 401 --------------------------------------------------
// When a request 401s on an expired access token, transparently refresh once
// and replay it. Concurrent 401s share a single in-flight refresh so we never
// fire the refresh endpoint many times at once.
let refreshPromise = null;

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then((response) => {
        const token = response.data?.data?.accessToken;
        setAccessToken(token ?? null);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // The refresh call itself failing means the session is truly gone.
    const isRefreshCall = original?.url?.includes('/auth/refresh');

    if (status === 401 && !original?._retried && !isRefreshCall) {
      original._retried = true;
      try {
        const token = await refreshAccessToken();
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      } catch {
        // fall through to session-expired handling
      }
      setAccessToken(null);
      onSessionExpired?.();
    }

    return Promise.reject(error);
  },
);

/** Normalizes an axios error into a message + code + field errors. */
export function toApiError(error) {
  const data = error?.response?.data;
  return {
    message: data?.message || error?.message || 'Something went wrong. Please try again.',
    code: data?.code || 'UNKNOWN',
    errors: data?.errors || [],
    status: error?.response?.status ?? 0,
  };
}

export default api;
