/**
 * Cache Key Generator - Creates unique cache keys based on vary-by configuration
 *
 * Cache keys are generated based on route's cache.varyBy settings:
 * - path: Include request path
 * - method: Include HTTP method
 * - queryParams: Include specific query parameters
 * - headers: Include specific headers
 * - body: Include request body hash
 *
 * Format: cache:route:{routeId}:{hash}
 */

import type { Route } from '../../../shared/src/types';
import type { RequestContext } from '../core/context-builder';

export class CacheKeyGenerator {
  /**
   * Generate cache key for a request
   */
  static generate(route: Route, context: RequestContext): string {
    const varyBy = route.cache?.varyBy;

    if (!varyBy) {
      // Default: vary by path and method
      return this.buildKey(route._id!, [context.request.path, context.request.method]);
    }

    const parts: string[] = [];

    // Add path if configured
    if (varyBy.path) {
      parts.push(`path:${context.request.path}`);
    }

    // Add method if configured
    if (varyBy.method) {
      parts.push(`method:${context.request.method}`);
    }

    // Add specific query parameters
    if (varyBy.queryParams && varyBy.queryParams.length > 0) {
      const queryParts: string[] = [];
      for (const param of varyBy.queryParams) {
        const value = context.request.query[param];
        if (value !== undefined) {
          queryParts.push(`${param}=${value}`);
        }
      }
      if (queryParts.length > 0) {
        parts.push(`query:${queryParts.join('&')}`);
      }
    }

    // Add specific headers
    if (varyBy.headers && varyBy.headers.length > 0) {
      const headerParts: string[] = [];
      for (const header of varyBy.headers) {
        const value = context.request.headers[header.toLowerCase()];
        if (value !== undefined && value !== '[REDACTED]') {
          headerParts.push(`${header}=${value}`);
        }
      }
      if (headerParts.length > 0) {
        parts.push(`headers:${headerParts.join('&')}`);
      }
    }

    // Add body hash if configured
    if (varyBy.body && context.request.body) {
      const bodyHash = this.hashString(context.request.body);
      parts.push(`body:${bodyHash}`);
    }

    return this.buildKey(route._id!, parts);
  }

  /**
   * Build final cache key with prefix and hash
   */
  private static buildKey(routeId: string, parts: string[]): string {
    // Create a deterministic hash from all parts
    const combined = parts.join('|');
    const hash = this.hashString(combined);

    return `cache:route:${routeId}:${hash}`;
  }

  /**
   * Simple hash function for strings
   * Using FNV-1a hash algorithm (fast and good distribution)
   */
  private static hashString(str: string): string {
    let hash = 2166136261; // FNV offset basis

    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    // Convert to unsigned 32-bit integer and then to hex
    return (hash >>> 0).toString(16);
  }

  /**
   * Generate invalidation pattern for a route
   * Returns a pattern that matches all cache keys for this route
   */
  static getInvalidationPattern(routeId: string): string {
    return `cache:route:${routeId}:*`;
  }

  /**
   * Check if a response should be cached based on conditions
   */
  static shouldCache(response: Response, cacheConfig: Route['cache']): boolean {
    if (!cacheConfig || !cacheConfig.enabled) {
      return false;
    }

    // Check status code conditions
    if (cacheConfig.conditions?.statusCodes) {
      if (!cacheConfig.conditions.statusCodes.includes(response.status)) {
        return false;
      }
    }

    // Check body size conditions
    if (cacheConfig.conditions?.maxBodySize !== undefined) {
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size > cacheConfig.conditions.maxBodySize) {
          return false;
        }
      }
    }

    return true;
  }
}
