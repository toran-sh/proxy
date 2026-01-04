import { detectRuntime, type HttpClient } from './types.js';
export type { HttpClient, HttpClientRequest, HttpClientResponse, NetworkTiming } from './types.js';

let cachedClient: HttpClient | null = null;

/**
 * Get the HTTP client for the current runtime.
 * - Edge: Uses native fetch (limited timing)
 * - Node.js: Uses http/https with socket timing (full timing)
 */
export async function getHttpClient(): Promise<HttpClient> {
  if (cachedClient) {
    return cachedClient;
  }

  const runtime = detectRuntime();
  let client: HttpClient;

  if (runtime === 'node') {
    // Dynamic import to avoid Edge bundler issues
    // Use string concatenation trick to hide from static analysis
    const modulePath = './node' + '-client.js';
    const { NodeHttpClientWithSocketTiming } = await import(modulePath);
    client = new NodeHttpClientWithSocketTiming();
  } else {
    const { EdgeHttpClient } = await import('./edge-client.js');
    client = new EdgeHttpClient();
  }

  cachedClient = client;
  return client;
}

/**
 * Reset the HTTP client (useful for testing).
 */
export function resetHttpClient(): void {
  cachedClient = null;
}
