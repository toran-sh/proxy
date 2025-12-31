import type { Runtime, CachedResponse, Env } from '../types/index.js';

let redisClient: unknown = null;
let upstashClient: unknown = null;

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: string, ttl: number): Promise<unknown>;
  setex(key: string, ttl: number, value: string): Promise<unknown>;
}

async function getRedisClient(runtime: Runtime): Promise<RedisLike | null> {
  if (runtime === 'cloudflare') {
    return null;
  }

  if (redisClient) {
    return redisClient as RedisLike;
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('REDIS_URL not set, caching disabled');
    return null;
  }

  try {
    const Redis = (await import('ioredis')).default;
    redisClient = new Redis(url);
    return redisClient as RedisLike;
  } catch (e) {
    console.error('Failed to connect to Redis:', e);
    return null;
  }
}

interface UpstashRedis {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<unknown>;
}

async function getUpstashClient(env: Env): Promise<UpstashRedis | null> {
  if (upstashClient) {
    return upstashClient as UpstashRedis;
  }

  const url = env.UPSTASH_REDIS_URL;
  const token = env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    console.warn('Upstash credentials not set, caching disabled');
    return null;
  }

  try {
    const { Redis } = await import('@upstash/redis');
    upstashClient = new Redis({ url, token });
    return upstashClient as UpstashRedis;
  } catch (e) {
    console.error('Failed to create Upstash client:', e);
    return null;
  }
}

export async function getFromCache(
  runtime: Runtime,
  key: string,
  env?: Env
): Promise<CachedResponse | null> {
  try {
    if (runtime === 'cloudflare') {
      if (!env) return null;
      const client = await getUpstashClient(env);
      if (!client) return null;

      const data = await client.get<CachedResponse>(key);
      if (!data) return null;

      // Check if expired
      if (data.cachedAt + data.ttl * 1000 < Date.now()) {
        return null;
      }

      return data;
    }

    const client = await getRedisClient(runtime);
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
  runtime: Runtime,
  key: string,
  data: CachedResponse,
  ttl: number,
  env?: Env
): Promise<void> {
  try {
    if (runtime === 'cloudflare') {
      if (!env) return;
      const client = await getUpstashClient(env);
      if (!client) return;

      await client.set(key, JSON.stringify(data), { ex: ttl });
      return;
    }

    const client = await getRedisClient(runtime);
    if (!client) return;

    await client.setex(key, ttl, JSON.stringify(data));
  } catch (e) {
    console.error('Cache set error:', e);
  }
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await (redisClient as { quit(): Promise<void> }).quit();
    redisClient = null;
  }
}
