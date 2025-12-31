export interface CacheMatchRule {
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface CacheRule {
  match: CacheMatchRule;
  ttl: number;
}

export interface HeaderConfig {
  add?: Record<string, string>;
  remove?: string[];
}

export interface UpstreamConfig {
  target: string;
  cacheRules?: CacheRule[];
  headers?: HeaderConfig;
}

export interface LoggingConfig {
  enabled: boolean;
  excludePaths?: string[];
}

export interface ProxyConfig {
  upstreams: Record<string, UpstreamConfig>;
  logging: LoggingConfig;
  baseDomain?: string;
}

export interface RequestLog {
  timestamp: Date;
  subdomain: string;
  request: {
    method: string;
    path: string;
    query: Record<string, string>;
    headers: Record<string, string>;
    body?: unknown;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    bodySize: number;
    cached: boolean;
  };
  duration: number;
  upstream: string;
}

export interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  cachedAt: number;
  ttl: number;
}

export type Runtime = 'node' | 'vercel' | 'cloudflare';

export interface Env {
  MONGODB_URI?: string;
  MONGODB_DATABASE?: string;
  REDIS_URL?: string;
  MONGODB_DATA_API_URL?: string;
  MONGODB_DATA_API_KEY?: string;
  UPSTASH_REDIS_URL?: string;
  UPSTASH_REDIS_TOKEN?: string;
  PROXY_CONFIG?: string;
}
