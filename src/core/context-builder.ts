/**
 * Context Builder - Builds request context for mutations and templates
 *
 * The context object contains all information available to:
 * - Template variable substitution (${...})
 * - Mutation conditions
 * - Logging
 */

import type { Env, FlattenedGateway } from '../../../shared/src/types';

export interface RequestContext {
  // Request information
  request: {
    method: string;
    url: string;
    path: string;
    hostname: string;
    query: Record<string, string>;
    headers: Record<string, string>;
    body: string | null;
    ip: string;
    userAgent: string;
    country?: string;
    region?: string;
    city?: string;
  };

  // Gateway information
  gateway: {
    id: string;
    subdomain: string;
    variables: Record<string, string>;
  };

  // Path parameters (extracted by router)
  params: Record<string, string>;

  // Environment
  env: {
    environment: string;
  };

  // Timing
  timing: {
    startedAt: Date;
  };
}

export class ContextBuilder {
  /**
   * Build request context from incoming request and gateway config
   */
  static async build(
    request: Request,
    gateway: FlattenedGateway,
    env: Env,
    pathParams: Record<string, string> = {}
  ): Promise<RequestContext> {
    const url = new URL(request.url);

    // Parse query parameters
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    // Extract headers (sanitize sensitive headers)
    const headers = this.extractHeaders(request);

    // Get request body (if present)
    const body = await this.extractBody(request);

    // Get Cloudflare request metadata (if available)
    const cf = (request as any).cf || {};

    return {
      request: {
        method: request.method,
        url: request.url,
        path: url.pathname,
        hostname: url.hostname,
        query,
        headers,
        body,
        ip: headers['cf-connecting-ip'] || headers['x-forwarded-for'] || 'unknown',
        userAgent: headers['user-agent'] || 'unknown',
        country: cf.country,
        region: cf.region,
        city: cf.city,
      },

      gateway: {
        id: gateway.id,
        subdomain: gateway.subdomain,
        variables: gateway.variables,
      },

      params: pathParams,

      env: {
        environment: env.ENVIRONMENT || 'production',
      },

      timing: {
        startedAt: new Date(),
      },
    };
  }

  /**
   * Extract and sanitize request headers
   * Removes sensitive headers and converts to plain object
   */
  private static extractHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    request.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();

      // Sanitize sensitive headers
      if (sensitiveHeaders.includes(lowerKey)) {
        headers[key] = '[REDACTED]';
      } else {
        headers[key] = value;
      }
    });

    return headers;
  }

  /**
   * Extract request body
   * Returns null for GET/HEAD requests or if body is empty
   */
  private static async extractBody(request: Request): Promise<string | null> {
    // GET and HEAD requests don't have bodies
    if (request.method === 'GET' || request.method === 'HEAD') {
      return null;
    }

    try {
      // Clone request to avoid consuming the body
      const cloned = request.clone();
      const text = await cloned.text();
      return text || null;
    } catch (error) {
      console.error('Failed to extract request body:', error);
      return null;
    }
  }
}
