import type { Context } from 'hono';
import type { ProxyConfig, UpstreamConfig } from '../types/index.js';

export interface SubdomainResult {
  subdomain: string;
  upstream: UpstreamConfig;
  cleanUrl: URL;
}

export function extractSubdomain(c: Context, config: ProxyConfig): SubdomainResult | null {
  const url = new URL(c.req.url);
  const host = c.req.header('host') || url.host;

  let subdomain: string | null = null;

  // Check for _sub_domain_ query parameter (localhost mode)
  const subdomainParam = url.searchParams.get('_sub_domain_');
  if (subdomainParam) {
    subdomain = subdomainParam;
    // Create clean URL without the _sub_domain_ param
    url.searchParams.delete('_sub_domain_');
  } else if (config.baseDomain) {
    // Production mode: extract subdomain from host
    // e.g., api.toran.sh -> api, cdn.toran.sh -> cdn
    const baseDomain = config.baseDomain.toLowerCase();
    const hostLower = host.toLowerCase();

    if (hostLower.endsWith(`.${baseDomain}`)) {
      subdomain = hostLower.slice(0, -(baseDomain.length + 1));
      // Handle nested subdomains (e.g., v2.api.toran.sh -> v2.api)
      // For now, we take the full prefix as the subdomain key
    } else if (hostLower === baseDomain) {
      // Root domain without subdomain - might need a default
      subdomain = null;
    }
  } else {
    // No base domain configured, try to extract first subdomain part
    // e.g., api.example.com -> api
    const parts = host.split('.');
    if (parts.length > 2) {
      subdomain = parts[0];
    }
  }

  if (!subdomain) {
    return null;
  }

  const upstream = config.upstreams[subdomain];
  if (!upstream) {
    return null;
  }

  return {
    subdomain,
    upstream,
    cleanUrl: url,
  };
}

export function buildUpstreamUrl(
  cleanUrl: URL,
  upstream: UpstreamConfig
): string {
  const targetUrl = new URL(upstream.target);

  // Preserve the path from the original request
  const path = cleanUrl.pathname;

  // Preserve query string
  const queryString = cleanUrl.search;

  return `${targetUrl.origin}${path}${queryString}`;
}
