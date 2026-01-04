export interface HeaderConfig {
  add?: Record<string, string>;
  remove?: string[];
}

export interface UpstreamConfig {
  upstreamBaseUrl: string;
  headers?: HeaderConfig;
  cacheTtl?: number;
  logResponseBody?: boolean;  // If true, include response body in logs
  maxResponseBodySize?: number;  // Max bytes to log (from plan tier)
}

export interface TimingMetrics {
  // Segment 1: Client → Proxy (receiving request)
  clientToProxy: {
    transfer: number;  // Time to read request body (ms), 0 for GET/HEAD
  };
  // Proxy processing overhead
  proxy: {
    overhead: number;  // Time for header filtering, cache checks, URL building (ms)
  };
  // Segment 2+3: Proxy ↔ Upstream
  upstreamToProxy: {
    dns?: number;      // DNS lookup time (ms) - Node.js only
    tcp?: number;      // TCP connection time (ms) - Node.js only
    tls?: number;      // TLS handshake time (ms) - Node.js only
    request?: number;  // Time to send request body (ms) - Node.js only
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
    body?: string;  // Text only (binary bodies omitted)
    bodyHash?: string;  // SHA256 of full body
    bodyTruncated?: boolean;  // True if body was truncated
  };
  duration: number;
  timing?: TimingMetrics;
  cacheStatus?: 'HIT' | 'MISS';
}
