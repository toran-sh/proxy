import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig, getConfig } from './config/loader.js';
import { extractSubdomain } from './routing/subdomain.js';
import { proxyRequest } from './proxy/handler.js';

export function createApp() {
  const app = new Hono();

  // Enable CORS
  app.use('*', cors());

  // Health check endpoint
  app.get('/health', (c) => {
    return c.json({ status: 'ok' });
  });

  // Main proxy handler
  app.all('*', async (c) => {
    // Load config if not already loaded
    try {
      loadConfig();
    } catch (e) {
      console.error('Failed to load config:', e);
      return c.json({ error: 'Configuration error' }, 500);
    }

    const config = getConfig();

    // Extract subdomain and find upstream
    const result = extractSubdomain(c, config);

    if (!result) {
      return c.json(
        {
          error: 'Unknown subdomain or upstream not configured',
          hint: 'Use _sub_domain_ query parameter in localhost mode',
        },
        404
      );
    }

    // Proxy the request
    try {
      return await proxyRequest(c, {
        subdomain: result.subdomain,
        upstream: result.upstream,
        cleanUrl: result.cleanUrl,
      });
    } catch (e) {
      console.error('Proxy error:', e);
      return c.json(
        {
          error: 'Proxy error',
          message: e instanceof Error ? e.message : 'Unknown error',
        },
        502
      );
    }
  });

  return app;
}

export { loadConfig, getConfig } from './config/loader.js';
export type { ProxyConfig, UpstreamConfig, CacheRule } from './types/index.js';
