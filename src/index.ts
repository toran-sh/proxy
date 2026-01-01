import { extractSubdomain } from './routing/subdomain.js';
import { proxyRequest } from './proxy/handler.js';
import type { UpstreamConfig } from './types/index.js';

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

// In-memory config cache
interface CachedConfig {
  config: UpstreamConfig;
  expiresAt: number;
}

const configCache = new Map<string, CachedConfig>();

function parseMaxAge(cacheControl: string | null): number | null {
  if (!cacheControl) return null;
  const match = cacheControl.match(/max-age=(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

interface ConfigResult {
  config: UpstreamConfig;
  cached: boolean;
}

async function fetchConfig(subdomain: string): Promise<ConfigResult | null> {
  // Check cache first
  const cached = configCache.get(subdomain);
  if (cached && cached.expiresAt > Date.now()) {
    return { config: cached.config, cached: true };
  }

  try {
    const res = await fetch(`${process.env.TORAN_API_URL}/api/${subdomain}/configuration`);
    if (!res.ok) {
      console.error(`Failed to fetch config for ${subdomain}: ${res.status}`);
      return null;
    }

    const config = await res.json() as UpstreamConfig;

    // Cache based on Cache-Control header
    const maxAge = parseMaxAge(res.headers.get('cache-control'));
    if (maxAge && maxAge > 0) {
      configCache.set(subdomain, {
        config,
        expiresAt: Date.now() + maxAge * 1000,
      });
    }

    return { config, cached: false };
  } catch (e) {
    console.error(`Error fetching config for ${subdomain}:`, e);
    return null;
  }
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

  // Extract subdomain
  const subdomain = extractSubdomain(request);

  if (!subdomain) {
    return addCorsHeaders(json({
      error: 'Unknown subdomain',
      hint: 'Use _sub_domain_ query parameter in localhost mode',
    }, 404));
  }

  // Fetch config from API
  const configResult = await fetchConfig(subdomain);

  if (!configResult) {
    return addCorsHeaders(json({
      error: 'Configuration not found for subdomain',
      subdomain,
    }, 404));
  }

  // Remove _sub_domain_ from URL before proxying
  url.searchParams.delete('_sub_domain_');

  // Proxy the request
  try {
    const response = await proxyRequest(request, {
      subdomain,
      upstream: configResult.config,
      cleanUrl: url,
    });

    // Add config cache header
    const headers = new Headers(response.headers);
    headers.set('x-config-cache', configResult.cached ? 'HIT' : 'MISS');

    return addCorsHeaders(new Response(response.body, {
      status: response.status,
      headers,
    }));
  } catch (e) {
    console.error('Proxy error:', e);
    return addCorsHeaders(json({
      error: 'Proxy error',
      message: e instanceof Error ? e.message : 'Unknown error',
    }, 502));
  }
}
