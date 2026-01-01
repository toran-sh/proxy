declare const EdgeRuntime: string | undefined;

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

async function createRedisClient(): Promise<CacheClient> {
  // String concatenation prevents bundler from statically analyzing this import
  const moduleName = 'io' + 'redis';
  const ioredis = await import(moduleName);
  const Redis = ioredis.default;
  const redis = new Redis(process.env.REDIS_URL!);

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

function isEdgeRuntime(): boolean {
  return typeof EdgeRuntime !== 'undefined';
}

export async function getCache(): Promise<CacheClient | null> {
  if (cacheClient) return cacheClient;

  const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
  const hasRedis = !!process.env.REDIS_URL;

  if (!hasUpstash && !hasRedis) {
    return null;
  }

  try {
    if (isEdgeRuntime()) {
      // Edge runtime: use Upstash (HTTP)
      if (hasUpstash) {
        cacheClient = await createUpstashClient();
      }
    } else {
      // Node.js runtime: use ioredis (TCP)
      if (hasRedis) {
        cacheClient = await createRedisClient();
      }
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
