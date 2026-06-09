/**
 * Cloudflare Worker for geo-routing ugcoin.com
 *
 * Routes Indian users to the India frontend deployment,
 * and all other users to the US frontend deployment.
 *
 * Setup:
 * 1. Add your domain to Cloudflare (free tier)
 * 2. Create a Worker and paste this script
 * 3. Add a route: ugcoin.com/* -> this worker
 * 4. Set environment variables in Worker settings:
 *    - US_ORIGIN: https://us-frontend.onrender.com
 *    - IN_ORIGIN: https://india-frontend.onrender.com
 */

export default {
  async fetch(request, env) {
    const country = request.cf?.country || 'US';

    const origin = country === 'IN' ? env.IN_ORIGIN : env.US_ORIGIN;

    const url = new URL(request.url);
    const originUrl = new URL(url.pathname + url.search, origin);

    const response = await fetch(originUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    return response;
  },
};
