import { extractSubdomain } from './routing/subdomain.js';
import { proxyRequest } from './proxy/handler.js';
import type { UpstreamConfig } from './types/index.js';
import { env } from 'process';

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

async function fetchConfig(subdomain: string): Promise<UpstreamConfig | null> {
  try {
    console.log(`${env.TORAN_API_URL}/${subdomain}/configuration`)
    const res = await fetch(`${env.TORAN_API_URL}/${subdomain}/configuration`);
    if (!res.ok) {
      console.error(`Failed to fetch config for ${subdomain}: ${res.status}`);
      return null;
    }
    return await res.json() as UpstreamConfig;
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
  const config = await fetchConfig(subdomain);

  if (!config) {
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
      upstream: config,
      cleanUrl: url,
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
