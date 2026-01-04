/**
 * Detailed network timing metrics.
 * Edge runtime only provides ttfb/transfer.
 * Node.js runtime provides full breakdown.
 */
export interface NetworkTiming {
  dns?: number;      // DNS lookup time (ms) - Node.js only
  tcp?: number;      // TCP connection time (ms) - Node.js only
  tls?: number;      // TLS handshake time (ms) - Node.js only
  request?: number;  // Time to send request body (ms) - Node.js only
  ttfb: number;      // Time to first byte (ms) - always available
  transfer: number;  // Time to read response body (ms) - always available
}

export interface HttpClientResponse {
  status: number;
  headers: Headers;
  body: ArrayBuffer;
  timing: NetworkTiming;
}

export interface HttpClientRequest {
  url: string;
  method: string;
  headers: Headers;
  body?: ArrayBuffer;
}

export interface HttpClient {
  fetch(request: HttpClientRequest): Promise<HttpClientResponse>;
}

/**
 * Detect current runtime environment.
 */
export function detectRuntime(): 'edge' | 'node' {
  // Allow forcing edge mode via environment variable (useful for tests)
  if (typeof process !== 'undefined' && process.env?.FORCE_EDGE_RUNTIME === 'true') {
    return 'edge';
  }

  // Vercel Edge Runtime
  if (typeof EdgeRuntime !== 'undefined') {
    return 'edge';
  }

  // Cloudflare Workers - check for global caches with default property
  if (typeof globalThis !== 'undefined' && 'caches' in globalThis) {
    const caches = (globalThis as any).caches;
    if (caches && typeof caches.default !== 'undefined') {
      return 'edge';
    }
  }

  // Node.js
  if (typeof process !== 'undefined' && process.versions?.node) {
    return 'node';
  }

  // Default to edge (safer, works everywhere)
  return 'edge';
}

// Declare EdgeRuntime for TypeScript
declare const EdgeRuntime: string | undefined;
