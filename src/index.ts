/**
 * toran.dev API Accelerator & Debugger - Cloudflare Worker Entry Point
 *
 * Pipeline Flow:
 * 1. Validate configuration
 * 2. Parse subdomain from request
 * 3. Load gateway config (flattened, cached in KV)
 * 4. Match route using compiled regex
 * 5. Build request context (params, variables, etc.)
 * 6. Check cache - return immediately on cache hit
 * 7. Apply pre-request mutations (headers, query, body)
 * 8. Proxy request to destination
 * 9. Apply post-response mutations (headers, body, status)
 * 10. Store response in cache (if enabled and conditions met)
 * 11. Update stats asynchronously
 * 12. Log request/response with execution breakdown
 * 13. Return response to client
 */

import type { Env } from '../../shared/src/types';
import { GatewayLoader } from './core/gateway-loader';
import { Router } from './core/router';
import { ContextBuilder } from './core/context-builder';
import { MutationEngine } from './mutations/engine';
import { CacheManager } from './cache/cache-manager';
import { CacheKeyGenerator } from './cache/key-generator';
import { Logger } from './logging/logger';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = performance.now();

    try {
      // ========================================================================
      // 1. Validate Configuration
      // ========================================================================
      if (!env.GATEWAY_CONFIG) {
        return errorResponse('CONFIGURATION_ERROR', 'Gateway config KV namespace not bound', 500);
      }

      // ========================================================================
      // 2. Parse Subdomain
      // ========================================================================
      const routingStart = performance.now();
      const subdomain = extractSubdomain(request);

      if (!subdomain) {
        return errorResponse('INVALID_SUBDOMAIN', 'Invalid or missing subdomain', 400);
      }

      // ========================================================================
      // 3. Load Gateway Config (cached in KV)
      // ========================================================================
      const gateway = await GatewayLoader.load(subdomain, env);

      if (!gateway || !gateway.active) {
        return errorResponse('GATEWAY_NOT_FOUND', `Gateway '${subdomain}' not found or inactive`, 404);
      }

      // Debug: Check if routes are loaded
      console.log('Gateway loaded:', gateway.subdomain, 'Routes:', gateway.routes.length);
      console.log('Matching path:', new URL(request.url).pathname, 'Method:', request.method);

      // ========================================================================
      // 4. Match Route
      // ========================================================================
      const url = new URL(request.url);
      const routeMatch = Router.match(url.pathname, request.method, gateway.routes);

      if (!routeMatch) {
        console.log('No route matched. Available routes:', gateway.routes.map(r => r.path));
      }
      const routingEnd = performance.now();

      if (!routeMatch) {
        // Build context for logging (no route match)
        const context = await ContextBuilder.build(request, gateway, env, {});

        const noMatchResponse = new Response(
          JSON.stringify({
            error: 'NO_ROUTE_MATCH',
            message: 'No route matched for this request',
            debug: {
              path: url.pathname,
              method: request.method,
              routesCount: gateway.routes.length,
              routes: gateway.routes.map(r => ({ path: r.path, method: r.method, regex: r.pathRegex }))
            }
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json', 'X-Toran-Error': 'NO_ROUTE_MATCH' }
          }
        );

        // Log the no-match request
        ctx.waitUntil(
          Logger.logRequest(context, noMatchResponse, {
            routeId: null,
            routeMatched: false,
            cacheHit: false,
            mutationsApplied: { pre: 0, post: 0 },
            timing: {
              completedAt: new Date(),
              duration: performance.now() - startTime,
              breakdown: {
                routing: routingEnd - routingStart,
                proxy: 0,
              },
            },
          }, env)
        );

        return noMatchResponse;
      }

      const { route, pathParams } = routeMatch;

      // Build named path params using route path
      const namedParams = Router.buildNamedParams(url.pathname, route.pathRegex, route.path);

      // ========================================================================
      // 5. Build Request Context
      // ========================================================================
      const context = await ContextBuilder.build(request, gateway, env, namedParams || pathParams);

      // ========================================================================
      // 6. Check Cache (if enabled)
      // ========================================================================
      let cacheHit = false;
      let cacheKey: string | null = null;

      if (route.cache?.enabled) {
        const cachingStart = performance.now();
        cacheKey = CacheKeyGenerator.generate(route, context);
        const cached = await CacheManager.get(cacheKey, env.CACHE);
        const cachingEnd = performance.now();

        if (cached) {
          // Cache hit! Return cached response immediately
          cacheHit = true;
          const cachedResponse = CacheManager.toResponse(cached);

          // Log cache hit
          ctx.waitUntil(
            Logger.logRequest(context, cachedResponse, {
              routeId: route._id || null,
              routeName: route.name,
              routeMatched: true,
              cacheHit: true,
              mutationsApplied: { pre: 0, post: 0 },
              timing: {
                completedAt: new Date(),
                duration: performance.now() - startTime,
                breakdown: {
                  routing: routingEnd - routingStart,
                  proxy: 0,
                  caching: cachingEnd - cachingStart,
                },
              },
            }, env)
          );

          return cachedResponse;
        }
      }

      // ========================================================================
      // 7. Apply Pre-Request Mutations
      // ========================================================================
      const preMutationsStart = performance.now();
      const mutatedRequest = await MutationEngine.applyPreMutations(request, route, context);
      const preMutationsEnd = performance.now();

      // ========================================================================
      // 8. Proxy Request to Destination
      // ========================================================================
      const proxyStart = performance.now();
      const destinationUrl = buildDestinationUrl(route, context);

      // Proxy with mutated request
      const proxyResponse = await fetch(destinationUrl, {
        method: mutatedRequest.method,
        headers: mutatedRequest.headers,
        body: mutatedRequest.body,
      });

      const proxyEnd = performance.now();

      // ========================================================================
      // 9. Apply Post-Response Mutations
      // ========================================================================
      const postMutationsStart = performance.now();
      const mutatedResponse = await MutationEngine.applyPostMutations(proxyResponse, route, context);
      const postMutationsEnd = performance.now();

      // ========================================================================
      // 9. Add Response Headers
      // ========================================================================
      const response = mutatedResponse.response;
      response.headers.set('X-Toran-Gateway', subdomain);
      response.headers.set('X-Toran-Route', route.name);
      response.headers.set('X-Toran-Cache', 'MISS'); // Indicate cache miss

      // ========================================================================
      // 10. Store Response in Cache (if enabled and conditions met)
      // ========================================================================
      if (route.cache?.enabled && cacheKey && CacheKeyGenerator.shouldCache(response, route.cache)) {
        const cachingStart = performance.now();
        ctx.waitUntil(
          CacheManager.set(cacheKey, response, route.cache.ttl, route._id!, env.CACHE)
        );
      }

      // ========================================================================
      // 11. Log Request/Response
      // ========================================================================
      const endTime = performance.now();
      ctx.waitUntil(
        Logger.logRequest(context, response, {
          routeId: route._id || null,
          routeName: route.name,
          routeMatched: true,
          cacheHit: false,
          mutationsApplied: {
            pre: mutatedRequest.mutationsApplied || 0,
            post: mutatedResponse.mutationsApplied || 0,
          },
          timing: {
            completedAt: new Date(),
            duration: endTime - startTime,
            breakdown: {
              routing: routingEnd - routingStart,
              preMutations: preMutationsEnd - preMutationsStart,
              proxy: proxyEnd - proxyStart,
              postMutations: postMutationsEnd - postMutationsStart,
            },
          },
        }, env)
      );

      return response;
    } catch (error) {
      console.error('Unexpected error in worker:', error);
      return errorResponse(
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
        500
      );
    }
  },
};

/**
 * Extract subdomain from request hostname
 *
 * Expects format: subdomain.toran.dev or subdomain.custom-domain.com
 * Returns subdomain or null if invalid
 */
function extractSubdomain(request: Request): string | null {
  const url = new URL(request.url);
  const hostname = url.hostname;

  // Handle localhost and *.workers.dev for development/testing
  if (hostname === 'localhost' || hostname.startsWith('127.0.0.1') || hostname.includes('.workers.dev')) {
    // For local dev/testing, use query param: ?subdomain=test
    return url.searchParams.get('subdomain') || 'test';
  }

  // Extract subdomain (first part before first dot)
  const parts = hostname.split('.');

  if (parts.length < 2) {
    return null;
  }

  const subdomain = parts[0];

  // Validate subdomain format (alphanumeric and hyphens only)
  if (!/^[a-zA-Z0-9-]+$/.test(subdomain)) {
    return null;
  }

  return subdomain;
}

/**
 * Build destination URL from route and context
 *
 * Supports template variables:
 * - ${params.id} - Path parameters
 * - ${variables.API_KEY} - Gateway variables
 * - ${BASE_URL} - Gateway base URL
 */
function buildDestinationUrl(route: any, context: any): string {
  let url = route.destination.url;

  // Simple template substitution (Phase 2 will use proper template engine)
  // Replace ${params.xxx}
  for (const [key, value] of Object.entries(context.params)) {
    url = url.replace(`\${params.${key}}`, value as string);
  }

  // Replace ${variables.xxx}
  for (const [key, value] of Object.entries(context.gateway.variables)) {
    url = url.replace(`\${variables.${key}}`, value as string);
    url = url.replace(`\${${key}}`, value as string); // Shorthand
  }

  return url;
}

/**
 * Create error response
 */
function errorResponse(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
      },
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Toran-Error': code,
      },
    }
  );
}
