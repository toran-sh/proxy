import type { UpstreamConfig, RequestLog } from '../types/index.js';
import { filterRequestHeaders, filterResponseHeaders, addForwardedHeaders } from './headers.js';
import { buildUpstreamUrl } from '../routing/subdomain.js';

const API_BASE = 'https://toran.sh/api';

export interface ProxyContext {
  subdomain: string;
  upstream: UpstreamConfig;
  cleanUrl: URL;
}

async function sendLog(subdomain: string, log: RequestLog): Promise<void> {
  try {
    await fetch(`${API_BASE}/${subdomain}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
  } catch (e) {
    console.error('Failed to send log:', e);
  }
}

export async function proxyRequest(
  request: Request,
  ctx: ProxyContext
): Promise<Response> {
  const startTime = Date.now();
  const { subdomain, upstream, cleanUrl } = ctx;
  const method = request.method;
  const path = cleanUrl.pathname;

  // Parse query params
  const query: Record<string, string> = {};
  cleanUrl.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  // Get request body if present
  let requestBody: string | null = null;
  let parsedBody: unknown = undefined;

  if (method !== 'GET' && method !== 'HEAD') {
    requestBody = await request.text();
    if (requestBody) {
      try {
        parsedBody = JSON.parse(requestBody);
      } catch {
        parsedBody = requestBody;
      }
    }
  }

  // Get request headers as object
  const requestHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    requestHeaders[key.toLowerCase()] = value;
  });

  // Fetch from upstream
  const upstreamUrl = buildUpstreamUrl(cleanUrl, upstream);

  const headers = filterRequestHeaders(request.headers, upstream.headers);
  addForwardedHeaders(headers, request);

  const targetUrl = new URL(upstream.target);
  headers.set('host', targetUrl.host);

  const requestInit: RequestInit = {
    method: request.method,
    headers,
  };

  if (requestBody && method !== 'GET' && method !== 'HEAD') {
    requestInit.body = requestBody;
  }

  const response = await fetch(upstreamUrl, requestInit);
  const responseBody = await response.text();

  const responseHeaders: Record<string, string> = {};
  filterResponseHeaders(response.headers).forEach((value, key) => {
    responseHeaders[key] = value;
  });

  const duration = Date.now() - startTime;

  // Send log to API (fire and forget)
  sendLog(subdomain, {
    timestamp: new Date().toISOString(),
    request: {
      method,
      path,
      query,
      headers: requestHeaders,
      body: parsedBody,
    },
    response: {
      status: response.status,
      headers: responseHeaders,
      bodySize: responseBody.length,
    },
    duration,
  });

  // Build response
  const outHeaders = new Headers();
  for (const [key, value] of Object.entries(responseHeaders)) {
    outHeaders.set(key, value);
  }
  outHeaders.set('x-proxy-duration', `${duration}ms`);

  return new Response(responseBody, {
    status: response.status,
    headers: outHeaders,
  });
}
