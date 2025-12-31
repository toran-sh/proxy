import type { HeaderConfig } from '../types/index.js';

// Hop-by-hop headers that should not be forwarded
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'proxy-connection',
]);

// Headers that should be handled specially
const SPECIAL_HEADERS = new Set([
  'host',
  'content-length',
  'content-encoding',
]);

export function filterRequestHeaders(
  headers: Headers,
  headerConfig?: HeaderConfig
): Headers {
  const filtered = new Headers();

  // Copy headers, excluding hop-by-hop and special headers
  headers.forEach((value, key) => {
    const keyLower = key.toLowerCase();

    if (HOP_BY_HOP_HEADERS.has(keyLower)) {
      return;
    }

    if (SPECIAL_HEADERS.has(keyLower)) {
      return;
    }

    // Check if this header should be removed
    if (headerConfig?.remove?.some((h) => h.toLowerCase() === keyLower)) {
      return;
    }

    filtered.set(key, value);
  });

  // Add configured headers
  if (headerConfig?.add) {
    for (const [key, value] of Object.entries(headerConfig.add)) {
      filtered.set(key, value);
    }
  }

  return filtered;
}

export function filterResponseHeaders(headers: Headers): Headers {
  const filtered = new Headers();

  headers.forEach((value, key) => {
    const keyLower = key.toLowerCase();

    // Skip hop-by-hop headers
    if (HOP_BY_HOP_HEADERS.has(keyLower)) {
      return;
    }

    // Skip content-encoding as we may need to handle decompression
    if (keyLower === 'content-encoding') {
      return;
    }

    filtered.set(key, value);
  });

  return filtered;
}

export function headersToObject(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[key.toLowerCase()] = value;
  });
  return obj;
}

export function objectToHeaders(obj: Record<string, string>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(obj)) {
    headers.set(key, value);
  }
  return headers;
}

export function addForwardedHeaders(
  headers: Headers,
  originalRequest: Request
): void {
  const url = new URL(originalRequest.url);

  // Add X-Forwarded-* headers
  const existingFor = headers.get('x-forwarded-for');
  const clientIp = headers.get('cf-connecting-ip') ||
    headers.get('x-real-ip') ||
    'unknown';

  if (existingFor) {
    headers.set('x-forwarded-for', `${existingFor}, ${clientIp}`);
  } else {
    headers.set('x-forwarded-for', clientIp);
  }

  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
}
