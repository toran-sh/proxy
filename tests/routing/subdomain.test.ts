import { describe, it, expect } from 'vitest';
import { extractSubdomain, buildUpstreamUrl } from '../../src/routing/subdomain.js';

describe('extractSubdomain', () => {
  it('extracts subdomain from _sub_domain_ query parameter', () => {
    const request = new Request('http://localhost:3000/path?_sub_domain_=api');
    expect(extractSubdomain(request)).toBe('api');
  });

  it('extracts subdomain from host header with 3+ parts', () => {
    const request = new Request('http://api.toran.sh/path', {
      headers: { host: 'api.toran.sh' },
    });
    expect(extractSubdomain(request)).toBe('api');
  });

  it('extracts subdomain from nested subdomains', () => {
    const request = new Request('http://v1.api.toran.sh/path', {
      headers: { host: 'v1.api.toran.sh' },
    });
    expect(extractSubdomain(request)).toBe('v1');
  });

  it('returns null for two-part domain (no subdomain)', () => {
    const request = new Request('http://toran.sh/path', {
      headers: { host: 'toran.sh' },
    });
    expect(extractSubdomain(request)).toBeNull();
  });

  it('returns null for localhost without query param', () => {
    const request = new Request('http://localhost:3000/path');
    expect(extractSubdomain(request)).toBeNull();
  });

  it('prefers query param over host subdomain', () => {
    const request = new Request('http://api.toran.sh/path?_sub_domain_=other', {
      headers: { host: 'api.toran.sh' },
    });
    expect(extractSubdomain(request)).toBe('other');
  });
});

describe('buildUpstreamUrl', () => {
  it('builds upstream URL with path and query', () => {
    const cleanUrl = new URL('http://localhost/api/users?page=1');
    const upstream = { upstreamBaseUrl: 'https://backend.example.com' };

    const result = buildUpstreamUrl(cleanUrl, upstream);

    expect(result).toBe('https://backend.example.com/api/users?page=1');
  });

  it('preserves multiple query parameters', () => {
    const cleanUrl = new URL('http://localhost/search?q=test&limit=10&offset=0');
    const upstream = { upstreamBaseUrl: 'https://api.example.com' };

    const result = buildUpstreamUrl(cleanUrl, upstream);

    expect(result).toBe('https://api.example.com/search?q=test&limit=10&offset=0');
  });

  it('handles root path', () => {
    const cleanUrl = new URL('http://localhost/');
    const upstream = { upstreamBaseUrl: 'https://api.example.com' };

    const result = buildUpstreamUrl(cleanUrl, upstream);

    expect(result).toBe('https://api.example.com/');
  });

  it('handles URL without query string', () => {
    const cleanUrl = new URL('http://localhost/api/health');
    const upstream = { upstreamBaseUrl: 'https://backend.com' };

    const result = buildUpstreamUrl(cleanUrl, upstream);

    expect(result).toBe('https://backend.com/api/health');
  });

  it('ignores path in upstream base URL', () => {
    const cleanUrl = new URL('http://localhost/users');
    const upstream = { upstreamBaseUrl: 'https://api.example.com/v1' };

    const result = buildUpstreamUrl(cleanUrl, upstream);

    // Should use origin only, ignoring /v1 path in base URL
    expect(result).toBe('https://api.example.com/users');
  });
});
