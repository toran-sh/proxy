/**
 * Redis Client - Singleton Redis connection for Vercel Edge Runtime
 *
 * Supports multiple Redis URL formats:
 * - Upstash REST: https://xxx.upstash.io (requires REDIS_TOKEN env var)
 * - Standard Redis: redis://user:password@host:port
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

    // Parse Redis URL to determine type
    if (redisUrl.startsWith('http://') || redisUrl.startsWith('https://')) {
      // Upstash REST API format
      // Token can be in REDIS_TOKEN env var or embedded in URL
      const token = process.env.REDIS_TOKEN || '';
      redis = new Redis({
        url: redisUrl,
        token: token,
      });
    } else if (redisUrl.startsWith('redis://')) {
      // Standard Redis URL format: redis://user:password@host:port
      // Extract credentials from URL
      const url = new URL(redisUrl);
      const token = url.password || process.env.REDIS_TOKEN || '';

      // Convert to Upstash format if using Upstash
      // Otherwise, this assumes you're using Upstash REST API wrapper
      redis = new Redis({
        url: redisUrl.replace('redis://', 'https://').split('@')[1]?.split(':')[0] || redisUrl,
        token: token,
      });
    } else {
      // Fallback: assume it's a host and needs https prefix
      redis = new Redis({
        url: `https://${redisUrl}`,
        token: process.env.REDIS_TOKEN || '',
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
