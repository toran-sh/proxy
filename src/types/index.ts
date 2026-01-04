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

export interface TimingMetrics {
  // Segment 1: Client → Proxy (receiving request)
  clientToProxy: {
    transfer: number;  // Time to read request body (ms), 0 for GET/HEAD
  };
  // Segment 2: Proxy → Upstream (sending request) - bundled into upstreamToProxy.ttfb
  // Segment 3: Upstream → Proxy (receiving response)
  upstreamToProxy: {
    ttfb: number;      // Time to first byte from upstream (ms)
    transfer: number;  // Time to read response body (ms)
  };
  // Segment 4: Proxy → Client (sending response) - not measurable
  total: number;       // End-to-end duration (ms)
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
  timing?: TimingMetrics;
  cacheStatus?: 'HIT' | 'MISS';
}
