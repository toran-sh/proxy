/**
 * Enhanced Logger - Posts logs to WWW logging endpoint
 *
 * Features:
 * - Detailed timing breakdown (routing, mutations, proxy, caching)
 * - Request/response capture with size limits
 * - Error tracking with phase information
 * - Body truncation for large payloads
 * - Sends logs to WWW endpoint via HTTP POST
 */

import type { Log, Env } from '../../../shared/src/types';
import type { RequestContext } from '../core/context-builder';

const MAX_BODY_SIZE = 10 * 1024; // 10KB
const BODY_TRUNCATE_SUFFIX = '... [truncated]';

export interface LogTimingBreakdown {
  routing: number;
  preMutations?: number;
  proxy: number;
  postMutations?: number;
  caching?: number;
}

export interface LogOptions {
  routeId: string | null;
  routeName?: string;
  routeMatched: boolean;
  cacheHit: boolean;
  mutationsApplied: {
    pre: number;
    post: number;
  };
  timing: {
    completedAt: Date;
    duration: number;
    breakdown?: LogTimingBreakdown;
  };
  error?: {
    message: string;
    type: string;
    stack?: string;
    phase: 'routing' | 'pre-mutation' | 'proxy' | 'post-mutation' | 'caching';
  };
}

export class Logger {
  /**
   * Log request/response with execution details
   * Sends log to WWW logging endpoint
   */
  static async logRequest(
    context: RequestContext,
    response: Response,
    options: LogOptions,
    env: Env
  ): Promise<void> {
    try {
      // Extract response body (clone to avoid consuming)
      const responseClone = response.clone();
      const responseBody = await this.extractResponseBody(responseClone);

      // Sanitize request headers (already done in context, but double-check)
      const sanitizedRequestHeaders = this.sanitizeHeaders(context.request.headers);

      // Build log entry
      const log: Partial<Log> = {
        gatewayId: context.gateway.id,
        routeId: options.routeId,
        subdomain: context.gateway.subdomain,

        request: {
          method: context.request.method,
          url: context.request.url,
          path: context.request.path,
          query: context.request.query,
          headers: sanitizedRequestHeaders,
          body: this.truncateBody(context.request.body || ''),
          bodySize: context.request.body?.length || 0,
          ip: context.request.ip,
          userAgent: context.request.userAgent,
          country: context.request.country,
          region: context.request.region,
          city: context.request.city,
          pathParams: context.params,
        },

        response: {
          status: response.status,
          statusText: response.statusText,
          headers: this.extractResponseHeaders(response),
          body: this.truncateBody(responseBody),
          bodySize: responseBody.length,
        },

        execution: {
          routeMatched: options.routeMatched,
          routeName: options.routeName,
          cacheHit: options.cacheHit,
          mutationsApplied: options.mutationsApplied,
          timing: {
            startedAt: context.timing.startedAt,
            completedAt: options.timing.completedAt,
            duration: options.timing.duration,
            breakdown: options.timing.breakdown,
          },
        },

        error: options.error,
      };

      // Send log to WWW endpoint
      await this.sendLogToWWW(log, env);
    } catch (error) {
      console.error('Failed to log request:', error);
    }
  }

  /**
   * Send log to WWW logging endpoint via HTTP POST
   */
  private static async sendLogToWWW(log: Partial<Log>, env: Env): Promise<void> {
    try {
      const wwwApiUrl = env.WWW_API_URL || 'http://localhost:5173';
      const url = `${wwwApiUrl}/api/logs`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(log),
      });

      if (!response.ok) {
        console.error(`Failed to send log to WWW: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error sending log to WWW:', error);
    }
  }

  /**
   * Extract response body as text
   */
  private static async extractResponseBody(response: Response): Promise<string> {
    try {
      const text = await response.text();
      return text;
    } catch (error) {
      return '[Failed to extract body]';
    }
  }

  /**
   * Extract response headers as plain object
   */
  private static extractResponseHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};

    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return headers;
  }

  /**
   * Sanitize sensitive headers
   */
  private static sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveKeys = ['authorization', 'cookie', 'x-api-key', 'api-key'];

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Truncate body if it exceeds max size
   */
  private static truncateBody(body: string): string {
    if (body.length <= MAX_BODY_SIZE) {
      return body;
    }

    return body.substring(0, MAX_BODY_SIZE) + BODY_TRUNCATE_SUFFIX;
  }

  /**
   * Create timing breakdown from performance marks
   */
  static createTimingBreakdown(marks: {
    routingStart: number;
    routingEnd: number;
    preMutationsStart?: number;
    preMutationsEnd?: number;
    proxyStart: number;
    proxyEnd: number;
    postMutationsStart?: number;
    postMutationsEnd?: number;
    cachingStart?: number;
    cachingEnd?: number;
  }): LogTimingBreakdown {
    const breakdown: LogTimingBreakdown = {
      routing: marks.routingEnd - marks.routingStart,
      proxy: marks.proxyEnd - marks.proxyStart,
    };

    if (marks.preMutationsStart !== undefined && marks.preMutationsEnd !== undefined) {
      breakdown.preMutations = marks.preMutationsEnd - marks.preMutationsStart;
    }

    if (marks.postMutationsStart !== undefined && marks.postMutationsEnd !== undefined) {
      breakdown.postMutations = marks.postMutationsEnd - marks.postMutationsStart;
    }

    if (marks.cachingStart !== undefined && marks.cachingEnd !== undefined) {
      breakdown.caching = marks.cachingEnd - marks.cachingStart;
    }

    return breakdown;
  }
}
