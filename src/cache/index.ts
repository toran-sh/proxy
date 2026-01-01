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

async function createRedisClient(): Promise<CacheClient> {
  const { default: Redis } = await import('ioredis');
  const redis = new Redis(process.env.REDIS_URL);

  return {
    async get<T>(key: string): Promise<T | null> {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    },
    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    },
  };
}

function isVercel(): boolean {
  return !!process.env.VERCEL;
}

export async function getCache(): Promise<CacheClient | null> {
  if (cacheClient) return cacheClient;

  // Check if caching is enabled (either Vercel KV or Redis URL configured)
  const hasVercelKv = isVercel() && process.env.KV_REST_API_URL;
  const hasRedis = !!process.env.REDIS_URL;

  if (!hasVercelKv && !hasRedis) {
    return null;
  }

  try {
    if (hasVercelKv) {
      cacheClient = await createVercelKvClient();
    } else {
      console.log('Using Redis for caching');
      cacheClient = await createRedisClient();
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
