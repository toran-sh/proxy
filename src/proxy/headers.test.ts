import { describe, it, expect } from 'vitest';
import {
  filterRequestHeaders,
  filterResponseHeaders,
  headersToObject,
  objectToHeaders,
  addForwardedHeaders,
} from './headers.js';

describe('filterRequestHeaders', () => {
  it('removes hop-by-hop headers', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'connection': 'keep-alive',
      'keep-alive': 'timeout=5',
      'transfer-encoding': 'chunked',
      'proxy-authorization': 'Basic xxx',
    });

    const filtered = filterRequestHeaders(headers);

    expect(filtered.get('content-type')).toBe('application/json');
    expect(filtered.get('connection')).toBeNull();
    expect(filtered.get('keep-alive')).toBeNull();
    expect(filtered.get('transfer-encoding')).toBeNull();
    expect(filtered.get('proxy-authorization')).toBeNull();
  });

  it('removes special headers (host, content-length, content-encoding)', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'host': 'example.com',
      'content-length': '100',
      'content-encoding': 'gzip',
    });

    const filtered = filterRequestHeaders(headers);

    expect(filtered.get('content-type')).toBe('application/json');
    expect(filtered.get('host')).toBeNull();
    expect(filtered.get('content-length')).toBeNull();
    expect(filtered.get('content-encoding')).toBeNull();
  });

  it('removes headers specified in config', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'authorization': 'Bearer token',
      'x-api-key': 'secret',
    });

    const filtered = filterRequestHeaders(headers, {
      remove: ['authorization', 'x-api-key'],
    });

    expect(filtered.get('content-type')).toBe('application/json');
    expect(filtered.get('authorization')).toBeNull();
    expect(filtered.get('x-api-key')).toBeNull();
  });

  it('adds headers specified in config', () => {
    const headers = new Headers({
      'content-type': 'application/json',
    });

    const filtered = filterRequestHeaders(headers, {
      add: {
        'x-proxy': 'toran',
        'x-custom': 'value',
      },
    });

    expect(filtered.get('content-type')).toBe('application/json');
    expect(filtered.get('x-proxy')).toBe('toran');
    expect(filtered.get('x-custom')).toBe('value');
  });

  it('handles case-insensitive header removal', () => {
    const headers = new Headers({
      'Authorization': 'Bearer token',
      'X-API-Key': 'secret',
    });

    const filtered = filterRequestHeaders(headers, {
      remove: ['AUTHORIZATION', 'x-api-key'],
    });

    expect(filtered.get('authorization')).toBeNull();
    expect(filtered.get('x-api-key')).toBeNull();
  });

  it('works with no config', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'accept': '*/*',
    });

    const filtered = filterRequestHeaders(headers);

    expect(filtered.get('content-type')).toBe('application/json');
    expect(filtered.get('accept')).toBe('*/*');
  });
});

describe('filterResponseHeaders', () => {
  it('removes hop-by-hop headers', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'connection': 'keep-alive',
      'transfer-encoding': 'chunked',
    });

    const filtered = filterResponseHeaders(headers);

    expect(filtered.get('content-type')).toBe('application/json');
    expect(filtered.get('connection')).toBeNull();
    expect(filtered.get('transfer-encoding')).toBeNull();
  });

  it('removes content-encoding header', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'content-encoding': 'gzip',
    });

    const filtered = filterResponseHeaders(headers);

    expect(filtered.get('content-type')).toBe('application/json');
    expect(filtered.get('content-encoding')).toBeNull();
  });

  it('preserves normal response headers', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'cache-control': 'max-age=3600',
      'x-request-id': 'abc123',
      'etag': '"123456"',
    });

    const filtered = filterResponseHeaders(headers);

    expect(filtered.get('content-type')).toBe('application/json');
    expect(filtered.get('cache-control')).toBe('max-age=3600');
    expect(filtered.get('x-request-id')).toBe('abc123');
    expect(filtered.get('etag')).toBe('"123456"');
  });
});

describe('headersToObject', () => {
  it('converts Headers to lowercase key object', () => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Custom-Header': 'value',
    });

    const obj = headersToObject(headers);

    expect(obj).toEqual({
      'content-type': 'application/json',
      'x-custom-header': 'value',
    });
  });

  it('handles empty headers', () => {
    const headers = new Headers();
    const obj = headersToObject(headers);
    expect(obj).toEqual({});
  });
});

describe('objectToHeaders', () => {
  it('converts object to Headers', () => {
    const obj = {
      'content-type': 'application/json',
      'x-custom': 'value',
    };

    const headers = objectToHeaders(obj);

    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-custom')).toBe('value');
  });

  it('handles empty object', () => {
    const headers = objectToHeaders({});
    expect([...headers.entries()]).toHaveLength(0);
  });
});

describe('addForwardedHeaders', () => {
  it('adds X-Forwarded-* headers', () => {
    const headers = new Headers();
    const request = new Request('https://api.toran.sh/path');

    addForwardedHeaders(headers, request);

    expect(headers.get('x-forwarded-for')).toBe('unknown');
    expect(headers.get('x-forwarded-host')).toBe('api.toran.sh');
    expect(headers.get('x-forwarded-proto')).toBe('https');
  });

  it('uses cf-connecting-ip when available', () => {
    const headers = new Headers({
      'cf-connecting-ip': '1.2.3.4',
    });
    const request = new Request('http://localhost/path');

    addForwardedHeaders(headers, request);

    expect(headers.get('x-forwarded-for')).toBe('1.2.3.4');
  });

  it('uses x-real-ip when cf-connecting-ip not available', () => {
    const headers = new Headers({
      'x-real-ip': '5.6.7.8',
    });
    const request = new Request('http://localhost/path');

    addForwardedHeaders(headers, request);

    expect(headers.get('x-forwarded-for')).toBe('5.6.7.8');
  });

  it('appends to existing x-forwarded-for', () => {
    const headers = new Headers({
      'x-forwarded-for': '10.0.0.1',
      'cf-connecting-ip': '1.2.3.4',
    });
    const request = new Request('http://localhost/path');

    addForwardedHeaders(headers, request);

    expect(headers.get('x-forwarded-for')).toBe('10.0.0.1, 1.2.3.4');
  });

  it('handles http protocol', () => {
    const headers = new Headers();
    const request = new Request('http://api.toran.sh/path');

    addForwardedHeaders(headers, request);

    expect(headers.get('x-forwarded-proto')).toBe('http');
  });
});
