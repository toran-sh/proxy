import type { ProxyConfig, UpstreamConfig } from '../types/index.js';

export interface SubdomainResult {
  subdomain: string;
  upstream: UpstreamConfig;
  cleanUrl: URL;
}

export function extractSubdomain(request: Request, config: ProxyConfig): SubdomainResult | null {
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;

  let subdomain: string | null = null;

  // Check for _sub_domain_ query parameter (localhost mode)
  const subdomainParam = url.searchParams.get('_sub_domain_');
  if (subdomainParam) {
    subdomain = subdomainParam;
    // Create clean URL without the _sub_domain_ param
    url.searchParams.delete('_sub_domain_');
  } else if (config.baseDomain) {
    // Production mode: extract subdomain from host
    const baseDomain = config.baseDomain.toLowerCase();
    const hostLower = host.toLowerCase();

    if (hostLower.endsWith(`.${baseDomain}`)) {
      subdomain = hostLower.slice(0, -(baseDomain.length + 1));
    } else if (hostLower === baseDomain) {
      subdomain = null;
    }
  } else {
    // No base domain configured, try to extract first subdomain part
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
  const path = cleanUrl.pathname;
  const queryString = cleanUrl.search;

  return `${targetUrl.origin}${path}${queryString}`;
}
