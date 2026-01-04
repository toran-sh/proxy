export interface HeaderConfig {
  add?: Record<string, string>;
  remove?: string[];
}

export interface UpstreamConfig {
  upstreamBaseUrl: string;
  headers?: HeaderConfig;
  cacheTtl?: number;
  logResponseBody?: boolean;  // If true, include response body in logs
}

export interface UpstreamMetrics {
  ttfb: number;      // Time until headers received (ms)
  transfer: number;  // Time to read response body (ms)
  total: number;     // Total request duration (ms)
}

export interface RequestLog {
  timestamp: string;
  request: {
    method: string;
    path: string;
    query: Record<string, string>;
    headers: Record<string, string>;
    body?: unknown;
    bodySize: number;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    bodySize: number;
    body?: string;  // Optional: base64-encoded if binary, raw string if text
  };
  duration: number;
  upstreamMetrics?: UpstreamMetrics;
  cacheStatus?: 'HIT' | 'MISS';
}
