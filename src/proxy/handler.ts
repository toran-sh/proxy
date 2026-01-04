import type { UpstreamConfig, RequestLog, TimingMetrics } from '../types/index.js';
import { filterRequestHeaders, filterResponseHeaders, addForwardedHeaders } from './headers.js';
import { buildUpstreamUrl } from '../routing/subdomain.js';
import { getCache, buildCacheKey, type CachedResponse } from '../cache/index.js';
import { getHttpClient } from '../http/index.js';

/**
 * Try to decode a buffer as UTF-8 text.
 * Binary by default - returns null unless proven to be valid text.
 */
export function tryDecodeAsText(
  buffer: ArrayBuffer | Uint8Array,
  options?: {
    maxBytes?: number;              // Max bytes to decode (default 256KB)
    controlCharThreshold?: number;  // Max ratio of control chars (default 0.01 = 1%)
  }
): string | null {
  const {
    maxBytes = 262144,  // 256KB
    controlCharThreshold = 0.01,  // 1% - strict
  } = options ?? {};

  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // Empty buffer is valid text
  if (bytes.length === 0) return '';

  const decodeLen = Math.min(bytes.length, maxBytes);

  // 1. Null byte check - any null byte means binary
  for (let i = 0; i < decodeLen; i++) {
    if (bytes[i] === 0) return null;
  }

  // 2. UTF-8 decode - must be valid UTF-8
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, decodeLen));
  } catch {
    return null;
  }

  // 3. Control character check - reject if too many non-whitespace control chars
  let controlChars = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    // Control chars 0x00-0x1F except TAB(0x09), LF(0x0A), CR(0x0D)
    // Also include DEL (0x7F)
    if ((c <= 0x1f && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f) {
      controlChars++;
    }
  }
  if (text.length > 0 && controlChars / text.length > controlCharThreshold) {
    return null;
  }

  return text;
}

/**
 * Compute SHA256 hash of a buffer.
 */
async function sha256(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

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
        const cachedBodyBuffer = cached.isBase64
          ? Buffer.from(cached.body, 'base64')
          : Buffer.from(cached.body);
        const bodySize = cachedBodyBuffer.byteLength;

        // Prepare response body for logging if enabled
        let logBody: string | undefined;
        let logBodyHash: string | undefined;
        let logBodyTruncated = false;

        if (upstream.logResponseBody) {
          // Always compute hash of full body
          logBodyHash = await sha256(cachedBodyBuffer);

          // Try to decode as text (ignore content-type header)
          const fullText = tryDecodeAsText(cachedBodyBuffer);

          if (fullText !== null) {
            // It's text - potentially truncate
            const maxSize = upstream.maxResponseBodySize ?? 102400;

            if (fullText.length > maxSize) {
              logBody = fullText.slice(0, maxSize);
              logBodyTruncated = true;
            } else {
              logBody = fullText;
            }
          }
          // Binary bodies: logBody stays undefined
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
            bodyHash: logBodyHash,
            bodyTruncated: logBodyTruncated || undefined,
          },
          duration,
          cacheStatus: 'HIT',
        });

        const outHeaders = new Headers();
        for (const [key, value] of Object.entries(cached.headers)) {
          outHeaders.set(key, value);
        }
        return new Response(cachedBodyBuffer, {
          status: cached.status,
          headers: outHeaders,
        });
      }
    }
  }

  // Segment 1: Client → Proxy (read request body)
  const requestBodyStart = Date.now();
  let requestBuffer: ArrayBuffer | null = null;
  let parsedBody: unknown = undefined;

  if (method !== 'GET' && method !== 'HEAD') {
    requestBuffer = await request.arrayBuffer();

    if (requestBuffer.byteLength > 0) {
      // Try to decode as text (ignore content-type header)
      const requestBodyText = tryDecodeAsText(requestBuffer);
      if (requestBodyText !== null) {
        try {
          parsedBody = JSON.parse(requestBodyText);
        } catch {
          parsedBody = requestBodyText;
        }
      }
      // Binary request body: parsedBody stays undefined
    }
  }
  const clientToProxyTransfer = Date.now() - requestBodyStart;

  // Pre-upstream processing (header filtering, URL building, client init)
  const preUpstreamStart = Date.now();

  const upstreamUrl = buildUpstreamUrl(cleanUrl, upstream);

  const headers = filterRequestHeaders(request.headers, upstream.headers);
  addForwardedHeaders(headers, request);

  const targetUrl = new URL(upstream.upstreamBaseUrl);
  headers.set('host', targetUrl.host);

  const httpClient = await getHttpClient();

  const preUpstream = Date.now() - preUpstreamStart;

  // Segment 2+3: Proxy ↔ Upstream
  const httpResponse = await httpClient.fetch({
    url: upstreamUrl,
    method: request.method,
    headers,
    body: requestBuffer ?? undefined,
  });

  const responseBuffer = httpResponse.body;
  const networkTiming = httpResponse.timing;

  // Post-upstream processing (response headers, cache, body processing)
  const postUpstreamStart = Date.now();

  const responseHeaders: Record<string, string> = {};
  filterResponseHeaders(httpResponse.headers).forEach((value, key) => {
    responseHeaders[key] = value;
  });

  // Use the response from HTTP client
  const response = {
    status: httpResponse.status,
    ok: httpResponse.status >= 200 && httpResponse.status < 300,
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
  let bodyHash: string | undefined;
  let bodyTruncated = false;

  if (upstream.logResponseBody) {
    // Always compute hash of full body
    bodyHash = await sha256(responseBuffer);

    // Try to decode as text (ignore content-type header)
    const fullText = tryDecodeAsText(responseBuffer);

    if (fullText !== null) {
      // It's text - potentially truncate
      const maxSize = upstream.maxResponseBodySize ?? 102400; // 100KB default

      if (fullText.length > maxSize) {
        responseBody = fullText.slice(0, maxSize);
        bodyTruncated = true;
      } else {
        responseBody = fullText;
      }
    }
    // Binary bodies: responseBody stays undefined (skip logging body)
  }

  const postUpstream = Date.now() - postUpstreamStart;

  // Timing metrics (logging will be updated after sendLog)
  const timing: TimingMetrics = {
    clientToProxy: {
      transfer: clientToProxyTransfer,
    },
    proxy: {
      preUpstream,
      postUpstream,
      logging: 0,  // Updated after sendLog
    },
    upstreamToProxy: {
      dns: networkTiming.dns,
      tcp: networkTiming.tcp,
      tls: networkTiming.tls,
      request: networkTiming.request,
      ttfb: networkTiming.ttfb,
      transfer: networkTiming.transfer,
    },
    total: 0,  // Updated after sendLog
  };

  // Send log to API (must await on Edge - blocks response)
  const logStart = Date.now();
  await sendLog(subdomain, {
    timestamp: new Date().toISOString(),
    request: {
      method,
      path,
      query,
      headers: requestHeaders,
      body: parsedBody,
      bodySize: requestBuffer ? requestBuffer.byteLength : 0,
    },
    response: {
      status: response.status,
      headers: responseHeaders,
      bodySize: responseBuffer.byteLength,
      body: responseBody,
      bodyHash,
      bodyTruncated: bodyTruncated || undefined,
    },
    duration: Date.now() - startTime,  // Snapshot at log time
    timing,  // Note: logging=0 in log, actual value known after
    cacheStatus: shouldCache ? 'MISS' : undefined,
  });
  timing.proxy.logging = Date.now() - logStart;
  timing.total = Date.now() - startTime;

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
