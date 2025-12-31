import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types/index.js';
import { loadConfig, getConfig } from './config/loader-cloudflare.js';
import { extractSubdomain } from './routing/subdomain.js';
import { proxyRequest } from './proxy/handler-cloudflare.js';

type HonoEnv = {
  Bindings: Env;
};

const app = new Hono<HonoEnv>();

// Enable CORS
app.use('*', cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', runtime: 'cloudflare' });
});

// Main proxy handler
app.all('*', async (c) => {
  // Load config from env
  try {
    const envConfig = c.env?.PROXY_CONFIG;
    if (!envConfig) {
      return c.json({ error: 'PROXY_CONFIG env variable is required' }, 500);
    }
    loadConfig(envConfig);
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

export default app;
