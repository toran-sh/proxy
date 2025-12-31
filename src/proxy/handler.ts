import type { Context } from 'hono';
import type { UpstreamConfig, CachedResponse, Runtime, Env } from '../types/index.js';
import { filterRequestHeaders, filterResponseHeaders, addForwardedHeaders } from './headers.js';
import { buildUpstreamUrl } from '../routing/subdomain.js';
import { findMatchingCacheRule, generateCacheKey } from '../cache/matcher.js';
import { getFromCache, setInCache } from '../cache/redis.js';
import { logRequest } from '../logging/mongodb.js';
import { getConfig } from '../config/loader.js';

export interface ProxyContext {
  subdomain: string;
  upstream: UpstreamConfig;
  cleanUrl: URL;
  runtime: Runtime;
  env?: Env;
}

export async function proxyRequest(
  c: Context,
  ctx: ProxyContext
): Promise<Response> {
  const startTime = Date.now();
  const config = getConfig();

  const { subdomain, upstream, cleanUrl, runtime, env } = ctx;
  const method = c.req.method;
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
    requestBody = await c.req.text();
    if (requestBody) {
      try {
        parsedBody = JSON.parse(requestBody);
      } catch {
        // Not JSON, keep as string
        parsedBody = requestBody;
      }
    }
  }

  // Get request headers as object for logging and cache matching
  const requestHeaders: Record<string, string> = {};
  c.req.raw.headers.forEach((value, key) => {
    requestHeaders[key.toLowerCase()] = value;
  });

  // Check cache
  const matchingRule = findMatchingCacheRule(
    upstream.cacheRules || [],
    method,
    path,
    query,
    requestHeaders,
    parsedBody
  );

  let cached = false;
  let responseStatus: number;
  let responseHeaders: Record<string, string>;
  let responseBody: string;

  if (matchingRule && method === 'GET') {
    const cacheKey = generateCacheKey(subdomain, method, path, query, requestHeaders, matchingRule);
    const cachedResponse = await getFromCache(runtime, cacheKey, env);

    if (cachedResponse) {
      cached = true;
      responseStatus = cachedResponse.status;
      responseHeaders = cachedResponse.headers;
      responseBody = cachedResponse.body;
    } else {
      // Fetch from upstream
      const result = await fetchFromUpstream(c, upstream, cleanUrl, requestBody);
      responseStatus = result.status;
      responseHeaders = result.headers;
      responseBody = result.body;

      // Cache the response if successful
      if (responseStatus >= 200 && responseStatus < 400) {
        const cacheData: CachedResponse = {
          status: responseStatus,
          headers: responseHeaders,
          body: responseBody,
          cachedAt: Date.now(),
          ttl: matchingRule.ttl,
        };
        await setInCache(runtime, cacheKey, cacheData, matchingRule.ttl, env);
      }
    }
  } else {
    // No caching, fetch directly
    const result = await fetchFromUpstream(c, upstream, cleanUrl, requestBody);
    responseStatus = result.status;
    responseHeaders = result.headers;
    responseBody = result.body;
  }

  const duration = Date.now() - startTime;

  // Log the request/response
  if (config.logging.enabled) {
    const shouldLog = !config.logging.excludePaths?.some((p) => {
      if (p.includes('*')) {
        const regex = new RegExp('^' + p.replace(/\*/g, '.*') + '$');
        return regex.test(path);
      }
      return p === path;
    });

    if (shouldLog) {
      await logRequest(runtime, {
        timestamp: new Date(),
        subdomain,
        request: {
          method,
          path,
          query,
          headers: requestHeaders,
          body: parsedBody,
        },
        response: {
          status: responseStatus,
          headers: responseHeaders,
          bodySize: responseBody.length,
          cached,
        },
        duration,
        upstream: upstream.target,
      }, env);
    }
  }

  // Build response
  const headers = new Headers();
  for (const [key, value] of Object.entries(responseHeaders)) {
    headers.set(key, value);
  }

  // Add proxy headers
  headers.set('x-proxy-cache', cached ? 'HIT' : 'MISS');
  headers.set('x-proxy-duration', `${duration}ms`);

  return new Response(responseBody, {
    status: responseStatus,
    headers,
  });
}

async function fetchFromUpstream(
  c: Context,
  upstream: UpstreamConfig,
  cleanUrl: URL,
  body: string | null
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const upstreamUrl = buildUpstreamUrl(cleanUrl, upstream);

  // Prepare headers
  const headers = filterRequestHeaders(c.req.raw.headers, upstream.headers);
  addForwardedHeaders(headers, c.req.raw);

  // Set the host header to the upstream host
  const targetUrl = new URL(upstream.target);
  headers.set('host', targetUrl.host);

  // Make the request
  const requestInit: RequestInit = {
    method: c.req.method,
    headers,
  };

  if (body && c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    requestInit.body = body;
  }

  const response = await fetch(upstreamUrl, requestInit);

  // Get response body
  const responseBody = await response.text();

  // Filter response headers
  const filteredHeaders = filterResponseHeaders(response.headers);
  const headersObj: Record<string, string> = {};
  filteredHeaders.forEach((value, key) => {
    headersObj[key] = value;
  });

  return {
    status: response.status,
    headers: headersObj,
    body: responseBody,
  };
}
