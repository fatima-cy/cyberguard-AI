/**
 * CyberGuard AI — API Client
 *
 * Typed fetch wrapper that:
 * - Adds Authorization: Bearer <token> header when token is set
 * - On 401, attempts token refresh via /api/v1/auth/refresh (cookie-based)
 * - On refresh success, retries the original request once
 * - On refresh failure, calls onUnauthenticated() to clear auth state
 *
 * Access tokens are stored in memory only — never localStorage.
 * Refresh tokens are in HttpOnly cookies managed by the browser.
 *
 * Sprint 4.5.3 — API base URL. Locally this resolves to an empty string, so
 * paths stay exactly as they were (relative, handled by Vite's dev proxy in
 * vite.config.ts). In a production build, VITE_API_BASE_URL is baked in at
 * build time and every request goes to the real deployed API instead —
 * there's no equivalent of Vite's dev proxy once this is a static build.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/** Exported so components making raw fetch() calls (e.g. file export
 *  downloads in PolicyViewer.tsx/PhishingPage.tsx) can prefix consistently
 *  without duplicating this logic. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

type OnUnauthenticated = () => void;

let _accessToken: string | null = null;
let _onUnauthenticated: OnUnauthenticated | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setOnUnauthenticated(fn: OnUnauthenticated): void {
  _onUnauthenticated = fn;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipAuth && _accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const response = await fetch(apiUrl(path), { ...fetchOptions, headers, credentials: 'include' });

  // On 401, try refresh once
  if (response.status === 401 && !skipAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry original request with new token
      headers['Authorization'] = `Bearer ${_accessToken}`;
      const retryResponse = await fetch(apiUrl(path), { ...fetchOptions, headers, credentials: 'include' });
      if (!retryResponse.ok) {
        const err = await retryResponse.json().catch(() => ({}));
        throw new ApiError(retryResponse.status, err?.detail ?? 'Request failed');
      }
      return retryResponse.json() as Promise<T>;
    } else {
      _onUnauthenticated?.();
      throw new ApiError(401, 'Session expired. Please sign in again.');
    }
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new ApiError(response.status, err?.detail ?? 'Request failed', err);
  }

  // Handle empty responses (e.g. 204)
  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

async function tryRefresh(): Promise<boolean> {
  try {
    const response = await fetch(apiUrl('/api/v1/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) return false;
    const data = await response.json();
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, options?: ApiOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string, options?: ApiOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
