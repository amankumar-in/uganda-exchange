/**
 * Single source of truth for API + WebSocket base URLs.
 *
 * Resolution order (for both API and WS):
 *   1. NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL from env (production, or explicit override)
 *   2. Runtime: derive from window.location.hostname so that dev on localhost,
 *      LAN IP (e.g. iPhone at http://192.168.x.x:3000), or tunnels all work
 *      without reconfiguring. Backend runs on port 8001 in this repo.
 *   3. SSR fallback: http://localhost:8001
 *
 * Do NOT hardcode localhost in individual service files — import from here.
 */

const DEFAULT_BACKEND_PORT = 8001;

function deriveFromWindow(suffix: string): string | null {
  if (typeof window === 'undefined') return null;
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${DEFAULT_BACKEND_PORT}${suffix}`;
}

/** Base URL for HTTP calls, e.g. "http://192.168.1.20:8001/api" */
export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  return deriveFromWindow('/api') ?? `http://localhost:${DEFAULT_BACKEND_PORT}/api`;
}

/** Root URL (no /api suffix), for static file URLs and image hosts */
export function getBackendRootUrl(): string {
  const api = getApiBaseUrl();
  return api.replace(/\/api\/?$/, '');
}

/** WebSocket / Socket.IO base URL, e.g. "http://192.168.1.20:8001" */
export function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  return deriveFromWindow('') ?? `http://localhost:${DEFAULT_BACKEND_PORT}`;
}
