/**
 * Redis Client - Singleton Redis connection for Vercel Edge Runtime
 *
 * Supports Redis URL formats:
 * - Upstash REST: https://user:token@host or https://host (with token in query)
 * - Standard Redis: redis://user:password@host:port
 *
 * Note: All authentication should be embedded in the URL
 */

import { Redis } from '@upstash/redis';
import type { RedisClient } from '../shared/src/types';

let redisClient: RedisClient | null = null;

/**
 * Get or create Redis client instance
 * Uses singleton pattern to reuse connection across requests
 */
export function getRedisClient(redisUrl: string): RedisClient {
  if (!redisClient) {
    let redis: Redis;

    // Parse Redis URL to determine type and extract credentials
    if (redisUrl.startsWith('http://') || redisUrl.startsWith('https://')) {
      // Upstash REST API format
      // URL format: https://user:token@host or https://host?token=xxx
      try {
        const url = new URL(redisUrl);
        const token = url.password || url.searchParams.get('token') || '';
        const cleanUrl = token ? `${url.protocol}//${url.hostname}${url.pathname}` : redisUrl;

        redis = new Redis({
          url: cleanUrl,
          token: token,
        });
      } catch (error) {
        // If URL parsing fails, try direct connection
        redis = new Redis({ url: redisUrl, token: '' });
      }
    } else if (redisUrl.startsWith('redis://')) {
      // Standard Redis URL format: redis://user:password@host:port
      // Extract credentials from URL
      const url = new URL(redisUrl);
      const password = url.password || '';

      // For Upstash REST compatibility, convert to https
      const host = url.hostname;
      const cleanUrl = `https://${host}`;

      redis = new Redis({
        url: cleanUrl,
        token: password,
      });
    } else {
      // Plain URL without protocol - assume https
      redis = new Redis({
        url: `https://${redisUrl}`,
        token: '',
      });
    }

    redisClient = {
      async get(key: string): Promise<string | null> {
        const value = await redis.get(key);
        if (value === null || value === undefined) {
          return null;
        }
        return typeof value === 'string' ? value : JSON.stringify(value);
      },

      async set(key: string, value: string, options?: { ex?: number; px?: number }): Promise<string | null> {
        if (options?.ex) {
          await redis.setex(key, options.ex, value);
        } else if (options?.px) {
          await redis.psetex(key, options.px, value);
        } else {
          await redis.set(key, value);
        }
        return 'OK';
      },

      async del(key: string): Promise<number> {
        return await redis.del(key);
      },

      async keys(pattern: string): Promise<string[]> {
        return await redis.keys(pattern);
      },
    };
  }

  return redisClient;
}

/**
 * Reset client (useful for testing)
 */
export function resetRedisClient(): void {
  redisClient = null;
}
