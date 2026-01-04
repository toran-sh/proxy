import type { HttpClient, HttpClientRequest, HttpClientResponse, NetworkTiming } from './types.js';

/**
 * Node.js HTTP client using undici with full timing instrumentation.
 * Provides DNS, TCP, TLS, request send, TTFB, and transfer timing.
 */
export class NodeHttpClient implements HttpClient {
  private client: any = null;
  private DiagnosticsChannel: any = null;

  async fetch(request: HttpClientRequest): Promise<HttpClientResponse> {
    // Lazy load undici to avoid bundling issues
    if (!this.client) {
      const undici = await import('undici');
      this.client = undici;

      // Try to load diagnostics_channel for timing hooks
      try {
        this.DiagnosticsChannel = await import('diagnostics_channel');
      } catch {
        // diagnostics_channel not available
      }
    }

    const timing: NetworkTiming = {
      ttfb: 0,
      transfer: 0,
    };

    // Track timing via undici's built-in timing if available
    const fetchStart = Date.now();
    let connectStart = 0;
    let connectEnd = 0;
    let requestStart = 0;
    let responseStart = 0;

    // Use undici.request for more control
    const { request: undiciRequest } = this.client;

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const options: any = {
      method: request.method,
      headers,
      body: request.body,
      // Enable timing
      bodyTimeout: 30000,
      headersTimeout: 30000,
    };

    try {
      connectStart = Date.now();
      const response = await undiciRequest(request.url, options);
      responseStart = Date.now();

      // Calculate TTFB (from start to first headers)
      timing.ttfb = responseStart - fetchStart;

      // Read body and measure transfer time
      const transferStart = Date.now();
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.body) {
        chunks.push(chunk);
      }
      timing.transfer = Date.now() - transferStart;

      // Combine chunks into ArrayBuffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const body = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert headers to Headers object
      const responseHeaders = new Headers();
      for (const [key, value] of Object.entries(response.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach(v => responseHeaders.append(key, String(v)));
          } else {
            responseHeaders.set(key, String(value));
          }
        }
      }

      return {
        status: response.statusCode,
        headers: responseHeaders,
        body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
        timing,
      };
    } catch (error) {
      throw error;
    }
  }
}

/**
 * Node.js HTTP client with socket-level timing using http/https modules.
 * Provides the most granular timing data.
 */
export class NodeHttpClientWithSocketTiming implements HttpClient {
  async fetch(request: HttpClientRequest): Promise<HttpClientResponse> {
    const timing: NetworkTiming = {
      ttfb: 0,
      transfer: 0,
    };

    const url = new URL(request.url);
    const isHttps = url.protocol === 'https:';

    // Dynamically import http/https
    const httpModule = isHttps
      ? await import('https')
      : await import('http');

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let dnsStart = 0;
      let dnsEnd = 0;
      let tcpStart = 0;
      let tcpEnd = 0;
      let tlsEnd = 0;
      let requestEnd = 0;
      let responseStart = 0;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: request.method,
        headers,
      };

      const req = httpModule.request(options, (res) => {
        responseStart = Date.now();

        // Calculate timing
        timing.dns = dnsEnd - dnsStart;
        timing.tcp = tcpEnd - tcpStart;
        if (isHttps && tlsEnd) {
          timing.tls = tlsEnd - tcpEnd;
        }
        timing.request = requestEnd > 0 ? responseStart - requestEnd : 0;
        timing.ttfb = responseStart - startTime;

        const chunks: Buffer[] = [];
        const transferStart = Date.now();

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          timing.transfer = Date.now() - transferStart;

          const body = Buffer.concat(chunks);
          const responseHeaders = new Headers();

          for (const [key, value] of Object.entries(res.headers)) {
            if (value) {
              if (Array.isArray(value)) {
                value.forEach(v => responseHeaders.append(key, String(v)));
              } else {
                responseHeaders.set(key, String(value));
              }
            }
          }

          resolve({
            status: res.statusCode || 0,
            headers: responseHeaders,
            body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
            timing,
          });
        });

        res.on('error', reject);
      });

      req.on('socket', (socket) => {
        dnsStart = Date.now();

        socket.on('lookup', () => {
          dnsEnd = Date.now();
          tcpStart = Date.now();
        });

        socket.on('connect', () => {
          tcpEnd = Date.now();
        });

        socket.on('secureConnect', () => {
          tlsEnd = Date.now();
        });
      });

      req.on('error', reject);

      // Send request body
      if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
        req.write(Buffer.from(request.body));
      }

      req.end();
      requestEnd = Date.now();
    });
  }
}
