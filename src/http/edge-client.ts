import type { HttpClient, HttpClientRequest, HttpClientResponse, NetworkTiming } from './types.js';

/**
 * Edge runtime HTTP client using native fetch.
 * Limited timing - only TTFB and transfer are available.
 */
export class EdgeHttpClient implements HttpClient {
  async fetch(request: HttpClientRequest): Promise<HttpClientResponse> {
    const init: RequestInit = {
      method: request.method,
      headers: request.headers,
    };

    if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
    }

    // Measure TTFB (includes DNS, TCP, TLS, request send - all opaque)
    const fetchStart = Date.now();
    const response = await fetch(request.url, init);
    const ttfb = Date.now() - fetchStart;

    // Measure response body transfer
    const transferStart = Date.now();
    const body = await response.arrayBuffer();
    const transfer = Date.now() - transferStart;

    const timing: NetworkTiming = {
      // dns, tcp, tls, request - not available at Edge
      ttfb,
      transfer,
    };

    return {
      status: response.status,
      headers: response.headers,
      body,
      timing,
    };
  }
}
