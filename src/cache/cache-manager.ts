/**
 * Cache Manager - Manages response caching in Cloudflare KV
 *
 * Features:
 * - Store responses with TTL
 * - Retrieve cached responses
 * - Cache metadata (timestamp, ttl, headers)
 * - Automatic expiration via KV TTL
 */

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
   * Get cached response from KV
   */
  static async get(
    key: string,
    kv: KVNamespace | undefined
  ): Promise<CachedResponse | null> {
    if (!kv) {
      return null;
    }

    try {
      const cached = await kv.get(key, 'json');
      if (!cached) {
        return null;
      }

      return cached as CachedResponse;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Store response in KV cache
   */
  static async set(
    key: string,
    response: Response,
    ttl: number,
    routeId: string,
    kv: KVNamespace | undefined
  ): Promise<void> {
    if (!kv) {
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

      // Store in KV with TTL
      await kv.put(key, JSON.stringify(cachedResponse), {
        expirationTtl: ttl,
      });
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
  static async delete(key: string, kv: KVNamespace | undefined): Promise<void> {
    if (!kv) {
      return;
    }

    try {
      await kv.delete(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Delete all cache entries matching a pattern
   * Note: KV doesn't support wildcard deletes, so this is a placeholder
   * In production, you'd use KV's list() to find matching keys
   */
  static async deletePattern(
    pattern: string,
    kv: KVNamespace | undefined
  ): Promise<number> {
    if (!kv) {
      return 0;
    }

    try {
      // Extract prefix from pattern (e.g., "cache:route:123:*" -> "cache:route:123:")
      const prefix = pattern.replace(/\*$/, '');

      // List all keys with this prefix
      const list = await kv.list({ prefix });

      // Delete each key
      let deleted = 0;
      for (const key of list.keys) {
        await kv.delete(key.name);
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
