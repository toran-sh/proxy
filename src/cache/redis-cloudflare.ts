import { Redis } from '@upstash/redis';
import type { CachedResponse, Env } from '../types/index.js';

let upstashClient: Redis | null = null;

function getUpstashClient(env: Env): Redis | null {
  if (upstashClient) {
    return upstashClient;
  }

  const url = env.UPSTASH_REDIS_URL;
  const token = env.UPSTASH_REDIS_TOKEN;

  if (!url || !token) {
    return null;
  }

  upstashClient = new Redis({ url, token });
  return upstashClient;
}

export async function getFromCache(
  key: string,
  env: Env
): Promise<CachedResponse | null> {
  try {
    const client = getUpstashClient(env);
    if (!client) return null;

    const data = await client.get<CachedResponse>(key);
    if (!data) return null;

    // Check if expired
    if (data.cachedAt + data.ttl * 1000 < Date.now()) {
      return null;
    }

    return data;
  } catch (e) {
    console.error('Cache get error:', e);
    return null;
  }
}

export async function setInCache(
  key: string,
  data: CachedResponse,
  ttl: number,
  env: Env
): Promise<void> {
  try {
    const client = getUpstashClient(env);
    if (!client) return;

    await client.set(key, JSON.stringify(data), { ex: ttl });
  } catch (e) {
    console.error('Cache set error:', e);
  }
}
