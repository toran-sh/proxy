import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Runtime, Env } from './types/index.js';
import { loadConfig, getConfig, setConfig } from './config/loader.js';
import { extractSubdomain } from './routing/subdomain.js';
import { proxyRequest } from './proxy/handler.js';

type HonoEnv = {
  Bindings: Env;
  Variables: {
    runtime: Runtime;
  };
};

export function createApp(runtime: Runtime) {
  const app = new Hono<HonoEnv>();

  // Enable CORS
  app.use('*', cors());

  // Set runtime in context
  app.use('*', async (c, next) => {
    c.set('runtime', runtime);
    await next();
  });

  // Health check endpoint
  app.get('/health', (c) => {
    return c.json({ status: 'ok', runtime });
  });

  // Main proxy handler
  app.all('*', async (c) => {
    const currentRuntime = c.get('runtime');

    // Load config if not already loaded
    try {
      const envConfig = c.env?.PROXY_CONFIG;
      await loadConfig(currentRuntime, envConfig);
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
        runtime: currentRuntime,
        env: c.env,
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

export { loadConfig, setConfig, getConfig };
export type { ProxyConfig, UpstreamConfig, CacheRule } from './types/index.js';
