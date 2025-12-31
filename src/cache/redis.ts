import Redis from 'ioredis';
import type { CachedResponse } from '../types/index.js';

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('REDIS_URL not set, caching disabled');
    return null;
  }

  try {
    redisClient = new Redis(url);
    return redisClient;
  } catch (e) {
    console.error('Failed to connect to Redis:', e);
    return null;
  }
}

export async function getFromCache(key: string): Promise<CachedResponse | null> {
  try {
    const client = getRedisClient();
    if (!client) return null;

    const data = await client.get(key);
    if (!data) return null;

    const parsed = JSON.parse(data) as CachedResponse;

    // Check if expired (Redis TTL should handle this, but double-check)
    if (parsed.cachedAt + parsed.ttl * 1000 < Date.now()) {
      return null;
    }

    return parsed;
  } catch (e) {
    console.error('Cache get error:', e);
    return null;
  }
}

export async function setInCache(
  key: string,
  data: CachedResponse,
  ttl: number
): Promise<void> {
  try {
    const client = getRedisClient();
    if (!client) return;

    await client.setex(key, ttl, JSON.stringify(data));
  } catch (e) {
    console.error('Cache set error:', e);
  }
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
