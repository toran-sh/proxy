import type { UpstreamConfig } from '../types/index.js';

export function extractSubdomain(request: Request): string | null {
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;

  // Check for _sub_domain_ query parameter (localhost mode)
  const subdomainParam = url.searchParams.get('_sub_domain_');
  if (subdomainParam) {
    return subdomainParam;
  }

  // Extract subdomain from host (e.g., api.domain.com -> api)
  const parts = host.split('.');
  if (parts.length > 2) {
    return parts[0];
  }

  return null;
}

export function buildUpstreamUrl(cleanUrl: URL, upstream: UpstreamConfig): string {
  const targetUrl = new URL(upstream.target);
  const path = cleanUrl.pathname;
  const queryString = cleanUrl.search;

  return `${targetUrl.origin}${path}${queryString}`;
}
