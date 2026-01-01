import { loadConfig, getConfig } from './config/loader.js';
import { extractSubdomain } from './routing/subdomain.js';
import { proxyRequest } from './proxy/handler.js';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return addCorsHeaders(new Response(null, { status: 204 }));
  }

  // Health check
  if (url.pathname === '/health') {
    return addCorsHeaders(json({ status: 'ok' }));
  }

  // Load config
  try {
    loadConfig();
  } catch (e) {
    console.error('Failed to load config:', e);
    return addCorsHeaders(json({ error: 'Configuration error' }, 500));
  }

  const config = getConfig();

  // Extract subdomain and find upstream
  const result = extractSubdomain(request, config);

  if (!result) {
    return addCorsHeaders(json({
      error: 'Unknown subdomain or upstream not configured',
      hint: 'Use _sub_domain_ query parameter in localhost mode',
    }, 404));
  }

  // Proxy the request
  try {
    const response = await proxyRequest(request, {
      subdomain: result.subdomain,
      upstream: result.upstream,
      cleanUrl: result.cleanUrl,
    });
    return addCorsHeaders(response);
  } catch (e) {
    console.error('Proxy error:', e);
    return addCorsHeaders(json({
      error: 'Proxy error',
      message: e instanceof Error ? e.message : 'Unknown error',
    }, 502));
  }
}

export { loadConfig, getConfig } from './config/loader.js';
export type { ProxyConfig, UpstreamConfig, CacheRule } from './types/index.js';
