import { minimatch } from 'minimatch';
import type { CacheRule, CacheMatchRule } from '../types/index.js';

export { generateCacheKey } from './key.js';

export function findMatchingCacheRule(
  rules: CacheRule[],
  method: string,
  path: string,
  query: Record<string, string>,
  headers: Record<string, string>,
  body?: unknown
): CacheRule | null {
  for (const rule of rules) {
    if (matchesRule(rule.match, method, path, query, headers, body)) {
      return rule;
    }
  }
  return null;
}

function matchesRule(
  match: CacheMatchRule,
  method: string,
  path: string,
  query: Record<string, string>,
  headers: Record<string, string>,
  body?: unknown
): boolean {
  // Check method
  if (match.method && match.method.toUpperCase() !== method.toUpperCase()) {
    return false;
  }

  // Check path pattern
  if (match.path && !matchPath(match.path, path)) {
    return false;
  }

  // Check headers
  if (match.headers && !matchHeaders(match.headers, headers)) {
    return false;
  }

  // Check query params
  if (match.query && !matchQuery(match.query, query)) {
    return false;
  }

  // Check body (JSON path matching)
  if (match.body && !matchBody(match.body, body)) {
    return false;
  }

  return true;
}

function matchPath(pattern: string, path: string): boolean {
  // Support multiple patterns separated by |
  const patterns = pattern.split('|').map((p) => p.trim());

  for (const p of patterns) {
    // Use minimatch for glob pattern matching
    if (minimatch(path, p, { matchBase: true })) {
      return true;
    }
  }

  return false;
}

function matchHeaders(
  matchHeaders: Record<string, string>,
  headers: Record<string, string>
): boolean {
  for (const [key, pattern] of Object.entries(matchHeaders)) {
    const headerValue = headers[key.toLowerCase()];

    if (!headerValue) {
      return false;
    }

    if (!matchPattern(pattern, headerValue)) {
      return false;
    }
  }

  return true;
}

function matchQuery(
  matchQuery: Record<string, string>,
  query: Record<string, string>
): boolean {
  for (const [key, pattern] of Object.entries(matchQuery)) {
    const queryValue = query[key];

    if (queryValue === undefined) {
      return false;
    }

    if (!matchPattern(pattern, queryValue)) {
      return false;
    }
  }

  return true;
}

function matchBody(
  matchBody: Record<string, unknown>,
  body: unknown
): boolean {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const bodyObj = body as Record<string, unknown>;

  for (const [key, expectedValue] of Object.entries(matchBody)) {
    // Support dot notation for nested paths
    const actualValue = getNestedValue(bodyObj, key);

    if (actualValue === undefined) {
      return false;
    }

    if (typeof expectedValue === 'string') {
      if (!matchPattern(expectedValue, String(actualValue))) {
        return false;
      }
    } else if (actualValue !== expectedValue) {
      return false;
    }
  }

  return true;
}

function matchPattern(pattern: string, value: string): boolean {
  // Exact match
  if (pattern === value) {
    return true;
  }

  // Wildcard pattern (convert to regex)
  if (pattern.includes('*')) {
    const regexPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(value);
  }

  return false;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}
