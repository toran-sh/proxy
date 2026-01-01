export interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface CacheClient {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

let cacheClient: CacheClient | null = null;

async function createVercelKvClient(): Promise<CacheClient> {
  const { kv } = await import('@vercel/kv');
  return {
    async get<T>(key: string): Promise<T | null> {
      return await kv.get<T>(key);
    },
    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      await kv.set(key, value, { ex: ttlSeconds });
    },
  };
}

async function createUpstashClient(): Promise<CacheClient> {
  const { Redis } = await import('@upstash/redis');
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  return {
    async get<T>(key: string): Promise<T | null> {
      return await redis.get<T>(key);
    },
    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      await redis.setex(key, ttlSeconds, value);
    },
  };
}

function isVercel(): boolean {
  return !!process.env.VERCEL;
}

export async function getCache(): Promise<CacheClient | null> {
  if (cacheClient) return cacheClient;

  // Check if caching is enabled (either Vercel KV or Upstash Redis configured)
  const hasVercelKv = isVercel() && process.env.KV_REST_API_URL;
  const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!hasVercelKv && !hasUpstash) {
    return null;
  }

  try {
    if (hasVercelKv) {
      cacheClient = await createVercelKvClient();
    } else {
      cacheClient = await createUpstashClient();
    }
    return cacheClient;
  } catch (e) {
    console.error('Failed to initialize cache client:', e);
    return null;
  }
}

export function buildCacheKey(subdomain: string, method: string, url: URL): string {
  return `toran:${subdomain}:${method}:${url.pathname}${url.search}`;
}
