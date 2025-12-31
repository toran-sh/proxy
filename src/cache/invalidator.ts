/**
 * Cache Invalidator - Provides cache invalidation utilities
 *
 * Invalidation strategies:
 * - By route: Invalidate all cached responses for a route
 * - By gateway: Invalidate all cached responses for a gateway
 * - By key: Invalidate specific cache entry
 * - By pattern: Invalidate using custom pattern
 */

import { CacheManager } from './cache-manager';
import { CacheKeyGenerator } from './key-generator';

export class CacheInvalidator {
  /**
   * Invalidate all cache entries for a route
   * Called when route configuration changes
   */
  static async invalidateRoute(
    routeId: string,
    kv: KVNamespace | undefined
  ): Promise<number> {
    const pattern = CacheKeyGenerator.getInvalidationPattern(routeId);
    return CacheManager.deletePattern(pattern, kv);
  }

  /**
   * Invalidate all cache entries for a gateway
   * Called when gateway configuration changes
   */
  static async invalidateGateway(
    gatewayId: string,
    routeIds: string[],
    kv: KVNamespace | undefined
  ): Promise<number> {
    let totalDeleted = 0;

    // Invalidate each route's cache
    for (const routeId of routeIds) {
      const deleted = await this.invalidateRoute(routeId, kv);
      totalDeleted += deleted;
    }

    return totalDeleted;
  }

  /**
   * Invalidate specific cache entry by key
   */
  static async invalidateKey(
    key: string,
    kv: KVNamespace | undefined
  ): Promise<void> {
    await CacheManager.delete(key, kv);
  }

  /**
   * Invalidate all cache entries matching a custom pattern
   */
  static async invalidatePattern(
    pattern: string,
    kv: KVNamespace | undefined
  ): Promise<number> {
    return CacheManager.deletePattern(pattern, kv);
  }

  /**
   * Invalidate all cache entries (nuclear option)
   * Use with caution - prefer targeted invalidation
   */
  static async invalidateAll(kv: KVNamespace | undefined): Promise<number> {
    return CacheManager.deletePattern('cache:route:*', kv);
  }
}
