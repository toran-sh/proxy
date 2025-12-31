/**
 * Cache Manager - Manages response caching in Redis
 *
 * Features:
 * - Store responses with TTL
 * - Retrieve cached responses
 * - Cache metadata (timestamp, ttl, headers)
 * - Automatic expiration via Redis TTL
 */

import type { RedisClient } from '../shared/src/types';

export interface CachedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  metadata: {
    cachedAt: string;
    ttl: number;
    routeId: string;
  };
}

export class CacheManager {
  /**
   * Get cached response from Redis
   */
  static async get(
    key: string,
    redis: RedisClient | undefined
  ): Promise<CachedResponse | null> {
    if (!redis) {
      return null;
    }

    try {
      const cached = await redis.get(key);
      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as CachedResponse;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Store response in Redis cache
   */
  static async set(
    key: string,
    response: Response,
    ttl: number,
    routeId: string,
    redis: RedisClient | undefined
  ): Promise<void> {
    if (!redis) {
      return;
    }

    try {
      // Clone response to avoid consuming body
      const cloned = response.clone();

      // Extract response data
      const body = await cloned.text();
      const headers = this.headersToObject(cloned.headers);

      // Build cached response object
      const cachedResponse: CachedResponse = {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
        body,
        metadata: {
          cachedAt: new Date().toISOString(),
          ttl,
          routeId,
        },
      };

      // Store in Redis with TTL (seconds)
      await redis.set(key, JSON.stringify(cachedResponse), { ex: ttl });
    } catch (error) {
      console.error('Cache set error:', error);
      // Don't throw - caching is non-critical
    }
  }

  /**
   * Convert cached response to Response object
   */
  static toResponse(cached: CachedResponse): Response {
    // Reconstruct headers
    const headers = new Headers(cached.headers);

    // Add cache metadata headers
    headers.set('X-Toran-Cache', 'HIT');
    headers.set('X-Toran-Cache-Age', this.getCacheAge(cached.metadata.cachedAt).toString());

    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers,
    });
  }

  /**
   * Delete cached response
   */
  static async delete(key: string, redis: RedisClient | undefined): Promise<void> {
    if (!redis) {
      return;
    }

    try {
      await redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Delete all cache entries matching a pattern
   */
  static async deletePattern(
    pattern: string,
    redis: RedisClient | undefined
  ): Promise<number> {
    if (!redis) {
      return 0;
    }

    try {
      // Find all keys matching pattern
      const keys = await redis.keys(pattern);

      // Delete each key
      let deleted = 0;
      for (const key of keys) {
        await redis.del(key);
        deleted++;
      }

      return deleted;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return 0;
    }
  }

  /**
   * Get cache age in seconds
   */
  private static getCacheAge(cachedAt: string): number {
    const cached = new Date(cachedAt);
    const now = new Date();
    return Math.floor((now.getTime() - cached.getTime()) / 1000);
  }

  /**
   * Convert Headers to plain object
   */
  private static headersToObject(headers: Headers): Record<string, string> {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
}
