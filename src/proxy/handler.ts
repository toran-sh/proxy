import type { UpstreamConfig, RequestLog, TimingMetrics } from '../types/index.js';
import { filterRequestHeaders, filterResponseHeaders, addForwardedHeaders } from './headers.js';
import { buildUpstreamUrl } from '../routing/subdomain.js';
import { getCache, buildCacheKey, type CachedResponse } from '../cache/index.js';

export interface ProxyContext {
  subdomain: string;
  upstream: UpstreamConfig;
  cleanUrl: URL;
}

async function sendLog(subdomain: string, log: RequestLog): Promise<void> {
  if (!process.env.TORAN_API_URL) {
    console.error('TORAN_API_URL not set, skipping log');
    return;
  }
  const url = `${process.env.TORAN_API_URL}/api/${subdomain}/log`;
  console.log('Sending log to:', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    if (!res.ok) {
      console.error('Log API error:', res.status, await res.text());
    } else {
      console.log('Log sent successfully');
    }
  } catch (e) {
    console.error('Failed to send log to', url, e);
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

  // Check cache for GET requests with cacheTtl configured
  const shouldCache = method === 'GET' && upstream.cacheTtl && upstream.cacheTtl > 0;
  const cacheKey = shouldCache ? buildCacheKey(subdomain, method, cleanUrl) : null;

  // Get request headers as object (needed for logging)
  const requestHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    requestHeaders[key.toLowerCase()] = value;
  });

  if (shouldCache && cacheKey) {
    const cache = await getCache();
    if (cache) {
      const cached = await cache.get<CachedResponse>(cacheKey);
      if (cached) {
        const duration = Date.now() - startTime;

        // Decode body from base64 if stored that way
        const cachedBody = cached.isBase64
          ? Buffer.from(cached.body, 'base64')
          : cached.body;
        const bodySize = cached.isBase64
          ? Buffer.from(cached.body, 'base64').byteLength
          : cached.body.length;

        // Prepare response body for logging if enabled
        let logBody: string | undefined;
        if (upstream.logResponseBody) {
          const contentType = cached.headers['content-type'] || '';
          const isText = contentType.includes('text/') ||
            contentType.includes('application/json') ||
            contentType.includes('application/xml') ||
            contentType.includes('application/javascript');

          if (isText) {
            logBody = typeof cachedBody === 'string' ? cachedBody : new TextDecoder().decode(cachedBody);
          } else {
            logBody = cached.body; // Already base64 if binary
          }
        }

        // Log cache hit (await to ensure it completes on Edge)
        await sendLog(subdomain, {
          timestamp: new Date().toISOString(),
          request: {
            method,
            path,
            query,
            headers: requestHeaders,
            bodySize: 0, // Cache hits are always GET requests with no body
          },
          response: {
            status: cached.status,
            headers: cached.headers,
            bodySize,
            body: logBody,
          },
          duration,
          cacheStatus: 'HIT',
        });

        const outHeaders = new Headers();
        for (const [key, value] of Object.entries(cached.headers)) {
          outHeaders.set(key, value);
        }
        return new Response(cachedBody, {
          status: cached.status,
          headers: outHeaders,
        });
      }
    }
  }

  // Segment 1: Client → Proxy (read request body)
  const requestBodyStart = Date.now();
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
  const clientToProxyTransfer = Date.now() - requestBodyStart;

  // Fetch from upstream
  const upstreamUrl = buildUpstreamUrl(cleanUrl, upstream);

  const headers = filterRequestHeaders(request.headers, upstream.headers);
  addForwardedHeaders(headers, request);

  const targetUrl = new URL(upstream.upstreamBaseUrl);
  headers.set('host', targetUrl.host);

  const requestInit: RequestInit = {
    method: request.method,
    headers,
  };

  if (requestBody && method !== 'GET' && method !== 'HEAD') {
    requestInit.body = requestBody;
  }

  // Segment 2+3: Proxy ↔ Upstream
  const fetchStart = Date.now();
  const response = await fetch(upstreamUrl, requestInit);
  const upstreamTtfb = Date.now() - fetchStart; // Time to first byte (headers received)

  const transferStart = Date.now();
  const responseBuffer = await response.arrayBuffer();
  const upstreamTransfer = Date.now() - transferStart; // Time to read response body

  const responseHeaders: Record<string, string> = {};
  filterResponseHeaders(response.headers).forEach((value, key) => {
    responseHeaders[key] = value;
  });

  const duration = Date.now() - startTime;

  // Timing metrics for all segments
  const timing: TimingMetrics = {
    clientToProxy: {
      transfer: clientToProxyTransfer,
    },
    upstreamToProxy: {
      ttfb: upstreamTtfb,
      transfer: upstreamTransfer,
    },
    total: duration,
  };

  // Store in cache if caching is enabled and response is successful
  if (shouldCache && cacheKey && response.ok) {
    const cache = await getCache();
    if (cache) {
      // Encode binary data as base64 for cache storage
      const bodyBase64 = Buffer.from(responseBuffer).toString('base64');
      const cachedResponse: CachedResponse = {
        status: response.status,
        headers: responseHeaders,
        body: bodyBase64,
        isBase64: true,
      };
      cache.set(cacheKey, cachedResponse, upstream.cacheTtl!).catch((e) => {
        console.error('Failed to cache response:', e);
      });
    }
  }

  // Prepare response body for logging if enabled
  let responseBody: string | undefined;
  if (upstream.logResponseBody) {
    const contentType = responseHeaders['content-type'] || '';
    const isText = contentType.includes('text/') ||
      contentType.includes('application/json') ||
      contentType.includes('application/xml') ||
      contentType.includes('application/javascript');

    if (isText) {
      // Decode as text
      responseBody = new TextDecoder().decode(responseBuffer);
    } else {
      // Encode binary as base64
      responseBody = Buffer.from(responseBuffer).toString('base64');
    }
  }

  // Send log to API (await to ensure it completes on Edge)
  await sendLog(subdomain, {
    timestamp: new Date().toISOString(),
    request: {
      method,
      path,
      query,
      headers: requestHeaders,
      body: parsedBody,
      bodySize: requestBody ? requestBody.length : 0,
    },
    response: {
      status: response.status,
      headers: responseHeaders,
      bodySize: responseBuffer.byteLength,
      body: responseBody,
    },
    duration,
    timing,
    cacheStatus: shouldCache ? 'MISS' : undefined,
  });

  // Build response
  const outHeaders = new Headers();
  for (const [key, value] of Object.entries(responseHeaders)) {
    outHeaders.set(key, value);
  }

  return new Response(responseBuffer, {
    status: response.status,
    headers: outHeaders,
  });
}
