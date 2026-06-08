/**
 * Production frontend origins. Hardcoded so deployments don't break if
 * FRONTEND_URL env is missing or wrong. FRONTEND_URL (comma-separated) is
 * merged on top, so additional/temporary origins can be added without code
 * changes. www/non-www counterparts are auto-included for every origin.
 */
const HARDCODED_FRONTEND_ORIGINS = [
  'https://intuitionexchange.com',
  'https://intuitionex.in',
  'https://intuitionex.com',
  'https://intuition-ind-frontend.onrender.com',
  'https://uganda-exchange-frontend.onrender.com',
];

function expandWwwPair(origin: string): string[] {
  try {
    const u = new URL(origin);
    const out = new Set<string>([u.origin]);
    const host = u.hostname;
    const otherHost = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    u.hostname = otherHost;
    out.add(u.origin);
    return [...out];
  } catch {
    return [origin];
  }
}

function getFrontendOrigins(): string[] {
  const out = new Set<string>();
  for (const o of HARDCODED_FRONTEND_ORIGINS) {
    for (const v of expandWwwPair(o)) out.add(v);
  }
  const raw = process.env.FRONTEND_URL;
  if (raw) {
    for (const entry of raw.split(',').map(s => s.trim()).filter(Boolean)) {
      for (const v of expandWwwPair(entry)) out.add(v);
    }
  }
  return [...out];
}

export function getAllowedOrigins(): string[] | true {
  if (process.env.NODE_ENV !== 'production') return true;
  const origins = getFrontendOrigins();
  return origins.length ? origins : true;
}

export function getWebSocketCorsOrigins(): string[] {
  const base = ['http://localhost:3000', 'http://localhost:3001'];
  const origins = getFrontendOrigins();
  return [...base, ...origins];
}
