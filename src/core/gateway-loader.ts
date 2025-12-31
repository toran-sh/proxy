/**
 * Gateway Loader - Loads gateway configurations from WWW API
 *
 * Architecture:
 * - Proxy fetches gateway configs from WWW API on demand
 * - Configs are cached in-memory with short TTL to reduce API calls
 * - No database or Redis access needed for config loading
 */

import type { Env, FlattenedGateway } from '../shared/src/types';

// In-memory cache for gateway configs (TTL: 60 seconds)
const configCache = new Map<string, { config: FlattenedGateway; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export class GatewayLoader {
  /**
   * Load gateway config from WWW API
   * Uses in-memory cache to reduce API calls
   */
  static async load(subdomain: string, env: Env): Promise<FlattenedGateway | null> {
    // Check in-memory cache first
    const cached = configCache.get(subdomain);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.config;
    }

    try {
      // Fetch from WWW API
      const wwwApiUrl = env.WWW_API_URL || 'http://localhost:5173';
      const url = `${wwwApiUrl}/api/gateways/${subdomain}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`Gateway '${subdomain}' not found`);
          return null;
        }
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const config = await response.json() as FlattenedGateway;

      // Cache the config
      configCache.set(subdomain, {
        config,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return config;
    } catch (error) {
      console.error('Failed to load gateway config from API:', error);

      // If we have a stale cache entry, return it as fallback
      const stale = configCache.get(subdomain);
      if (stale) {
        console.log('Using stale cached config as fallback');
        return stale.config;
      }

      return null;
    }
  }

  /**
   * Clear cache for a specific subdomain
   * Useful for forcing a refresh after config updates
   */
  static clearCache(subdomain?: string): void {
    if (subdomain) {
      configCache.delete(subdomain);
    } else {
      configCache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; entries: string[] } {
    return {
      size: configCache.size,
      entries: Array.from(configCache.keys()),
    };
  }
}
