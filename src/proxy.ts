/**
 * Core proxy logic for forwarding requests to destination servers
 */

import type { Mapping } from '../../shared/types';
import type { ProxyResult } from './types';
import { handleDestinationError } from './error-handler';

// Headers to exclude from forwarding
const EXCLUDED_HEADERS = new Set([
  'host',
  'cf-ray',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-visitor',
  'cf-request-id',
  'x-forwarded-proto',
  'x-real-ip',
]);

/**
 * Forward request to destination server
 */
export async function proxyRequest(
  originalRequest: Request,
  mapping: Mapping
): Promise<ProxyResult> {
  const startTime = Date.now();
  const startedAt = new Date();

  try {
    // Parse the original URL
    const url = new URL(originalRequest.url);

    // Construct destination URL
    const destinationUrl = buildDestinationUrl(url, mapping);

    // Create new request to destination
    const destinationRequest = await createDestinationRequest(
      originalRequest,
      destinationUrl
    );

    // Forward request to destination with timeout
    const response = await fetchWithTimeout(destinationRequest, 30000);

    // Clone response before returning (we'll need to read it for logging)
    const responseClone = response.clone();

    const completedAt = new Date();
    const duration = Date.now() - startTime;

    return {
      response: responseClone,
      timing: {
        startedAt,
        completedAt,
        duration,
      },
    };
  } catch (error) {
    const completedAt = new Date();
    const duration = Date.now() - startTime;

    // Return error response
    const errorResponse = handleDestinationError(error as Error, originalRequest);

    return {
      response: errorResponse,
      timing: {
        startedAt,
        completedAt,
        duration,
      },
      error: {
        message: (error as Error).message,
        type: (error as Error).name,
        stack: (error as Error).stack,
      },
    };
  }
}

/**
 * Build destination URL from original URL and mapping
 */
function buildDestinationUrl(originalUrl: URL, mapping: Mapping): string {
  const destinationBase = mapping.destinationUrl.endsWith('/')
    ? mapping.destinationUrl.slice(0, -1)
    : mapping.destinationUrl;

  // Preserve path if configured
  if (mapping.preservePath) {
    const path = originalUrl.pathname + originalUrl.search;
    return destinationBase + path;
  }

  // Just use destination URL (ignore original path)
  return destinationBase;
}

/**
 * Create destination request with filtered headers
 */
async function createDestinationRequest(
  originalRequest: Request,
  destinationUrl: string
): Promise<Request> {
  // Copy headers, excluding Cloudflare-specific ones
  const headers = new Headers();

  for (const [key, value] of originalRequest.headers.entries()) {
    if (!EXCLUDED_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  // Set Host header to destination
  const destinationHost = new URL(destinationUrl).host;
  headers.set('Host', destinationHost);

  // Add X-Forwarded headers for transparency
  headers.set('X-Forwarded-For', originalRequest.headers.get('cf-connecting-ip') || '');
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Forwarded-Host', originalRequest.headers.get('host') || '');

  // Add custom Toran headers
  headers.set('X-Toran-Proxy', 'true');

  // Clone request body if present
  let body: BodyInit | null = null;
  if (originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD') {
    // Clone the request to read body
    const clonedRequest = originalRequest.clone();
    body = await clonedRequest.arrayBuffer();
  }

  return new Request(destinationUrl, {
    method: originalRequest.method,
    headers,
    body,
    redirect: 'follow',
  });
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  request: Request,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(request, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if ((error as Error).name === 'AbortError') {
      const timeoutError = new Error(`Request timeout after ${timeoutMs}ms`);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }

    throw error;
  }
}

/**
 * Validate destination URL for security
 */
export function validateDestinationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow HTTPS (security requirement)
    if (parsed.protocol !== 'https:') {
      return false;
    }

    // Prevent SSRF to private IPs
    const hostname = parsed.hostname;

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }

    // Block private IP ranges (basic check)
    if (
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
