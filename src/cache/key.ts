import type { CacheRule } from '../types/index.js';

export function generateCacheKey(
  subdomain: string,
  method: string,
  path: string,
  query: Record<string, string>,
  headers: Record<string, string>,
  rule: CacheRule
): string {
  const parts: string[] = [subdomain, method, path];

  // Add sorted query params
  const sortedQuery = Object.keys(query)
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join('&');

  if (sortedQuery) {
    parts.push(sortedQuery);
  }

  // Add matched headers from the rule (if rule specifies headers to match)
  if (rule.match.headers) {
    const matchedHeaders = Object.keys(rule.match.headers)
      .sort()
      .map((k) => `${k}=${headers[k.toLowerCase()] || ''}`)
      .join('&');

    if (matchedHeaders) {
      parts.push(matchedHeaders);
    }
  }

  // Create a simple hash of the key
  const keyString = parts.join('|');
  return `toran:${simpleHash(keyString)}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex and ensure positive
  return Math.abs(hash).toString(16);
}
