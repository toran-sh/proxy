import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleRequest } from '../src/index.js';

describe('handleRequest', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.TORAN_API_URL;

  beforeEach(() => {
    process.env.TORAN_API_URL = 'https://toran.sh';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.TORAN_API_URL = originalEnv;
  });

  describe('CORS preflight', () => {
    it('handles OPTIONS request', async () => {
      const request = new Request('http://localhost/api', {
        method: 'OPTIONS',
      });

      const response = await handleRequest(request);

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toContain('GET');
      expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    });
  });

  describe('health check', () => {
    it('returns ok for /health endpoint', async () => {
      const request = new Request('http://localhost/health');

      const response = await handleRequest(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ status: 'ok' });
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });
  });

  describe('subdomain handling', () => {
    it('returns 404 for missing subdomain', async () => {
      const request = new Request('http://localhost/api/users');

      const response = await handleRequest(request);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Unknown subdomain');
    });

    it('returns 404 when config not found', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(null, { status: 404 })
      );

      const request = new Request('http://localhost/api?_sub_domain_=unknown');

      const response = await handleRequest(request);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Configuration not found for subdomain');
      expect(body.subdomain).toBe('unknown');
    });
  });

  describe('proxying', () => {
    it('proxies request to upstream when config exists', async () => {
      const mockConfig = {
        upstreamBaseUrl: 'https://api.example.com',
      };

      const mockUpstreamResponse = { data: 'test' };

      global.fetch = vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockConfig), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockUpstreamResponse), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        )
        .mockResolvedValueOnce(
          new Response(null, { status: 200 }) // log request
        );

      const request = new Request('http://localhost/users?_sub_domain_=api');

      const response = await handleRequest(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(mockUpstreamResponse);
      expect(response.headers.get('x-proxy-duration')).toMatch(/^\d+ms$/);
    });

    it('removes _sub_domain_ param before proxying', async () => {
      const mockConfig = {
        upstreamBaseUrl: 'https://api.example.com',
      };

      let capturedUrl: string | undefined;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/configuration')) {
          return Promise.resolve(
            new Response(JSON.stringify(mockConfig), { status: 200 })
          );
        }
        if (url.includes('api.example.com')) {
          capturedUrl = url;
          return Promise.resolve(
            new Response('{}', { status: 200 })
          );
        }
        // log endpoint
        return Promise.resolve(new Response(null, { status: 200 }));
      });

      const request = new Request(
        'http://localhost/users?_sub_domain_=api&page=1'
      );

      await handleRequest(request);

      expect(capturedUrl).toBe('https://api.example.com/users?page=1');
      expect(capturedUrl).not.toContain('_sub_domain_');
    });

    it('returns 502 on proxy error', async () => {
      const mockConfig = {
        upstreamBaseUrl: 'https://api.example.com',
      };

      global.fetch = vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify(mockConfig), { status: 200 })
        )
        .mockRejectedValueOnce(new Error('Connection refused'));

      const request = new Request('http://localhost/users?_sub_domain_=api');

      const response = await handleRequest(request);
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body.error).toBe('Proxy error');
      expect(body.message).toBe('Connection refused');
    });
  });

  describe('CORS headers', () => {
    it('adds CORS headers to all responses', async () => {
      const request = new Request('http://localhost/health');

      const response = await handleRequest(request);

      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(response.headers.get('access-control-allow-methods')).toBe(
        'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      );
      expect(response.headers.get('access-control-allow-headers')).toBe('*');
    });
  });
});
