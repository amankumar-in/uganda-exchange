/**
 * Returns the origin and its www/non-www counterpart so both are allowed by CORS.
 */
function getFrontendOriginPair(): string[] {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) return [];
  try {
    const u = new URL(frontendUrl);
    const host = u.hostname;
    const otherHost = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    u.hostname = otherHost;
    return [frontendUrl, u.origin];
  } catch {
    return [frontendUrl];
  }
}

export function getAllowedOrigins(): string[] | true {
  if (process.env.NODE_ENV !== 'production') return true;
  const pair = getFrontendOriginPair();
  return pair.length ? pair : true;
}

export function getWebSocketCorsOrigins(): string[] {
  const base = ['http://localhost:3000', 'http://localhost:3001'];
  const pair = getFrontendOriginPair();
  return pair.length ? [...base, ...pair] : base;
}
