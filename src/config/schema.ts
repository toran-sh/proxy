import type { ProxyConfig, UpstreamConfig, CacheRule, LoggingConfig } from '../types/index.js';

export function validateCacheRule(rule: unknown, index: number): CacheRule {
  if (!rule || typeof rule !== 'object') {
    throw new Error(`Cache rule at index ${index} must be an object`);
  }

  const r = rule as Record<string, unknown>;

  if (!r.match || typeof r.match !== 'object') {
    throw new Error(`Cache rule at index ${index} must have a 'match' object`);
  }

  if (typeof r.ttl !== 'number' || r.ttl <= 0) {
    throw new Error(`Cache rule at index ${index} must have a positive 'ttl' number`);
  }

  return {
    match: r.match as CacheRule['match'],
    ttl: r.ttl,
  };
}

export function validateUpstreamConfig(name: string, config: unknown): UpstreamConfig {
  if (!config || typeof config !== 'object') {
    throw new Error(`Upstream '${name}' must be an object`);
  }

  const c = config as Record<string, unknown>;

  if (typeof c.target !== 'string' || !c.target) {
    throw new Error(`Upstream '${name}' must have a 'target' URL string`);
  }

  try {
    new URL(c.target);
  } catch {
    throw new Error(`Upstream '${name}' has invalid target URL: ${c.target}`);
  }

  const cacheRules: CacheRule[] = [];
  if (c.cacheRules) {
    if (!Array.isArray(c.cacheRules)) {
      throw new Error(`Upstream '${name}' cacheRules must be an array`);
    }
    for (let i = 0; i < c.cacheRules.length; i++) {
      cacheRules.push(validateCacheRule(c.cacheRules[i], i));
    }
  }

  const result: UpstreamConfig = {
    target: c.target,
    cacheRules,
  };

  if (c.headers) {
    if (typeof c.headers !== 'object') {
      throw new Error(`Upstream '${name}' headers must be an object`);
    }
    result.headers = c.headers as UpstreamConfig['headers'];
  }

  return result;
}

export function validateLoggingConfig(config: unknown): LoggingConfig {
  if (!config || typeof config !== 'object') {
    return { enabled: true };
  }

  const c = config as Record<string, unknown>;

  return {
    enabled: c.enabled !== false,
    excludePaths: Array.isArray(c.excludePaths)
      ? c.excludePaths.filter((p): p is string => typeof p === 'string')
      : [],
  };
}

export function validateProxyConfig(config: unknown): ProxyConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be an object');
  }

  const c = config as Record<string, unknown>;

  if (!c.upstreams || typeof c.upstreams !== 'object') {
    throw new Error('Config must have an "upstreams" object');
  }

  const upstreams: Record<string, UpstreamConfig> = {};
  for (const [name, upstream] of Object.entries(c.upstreams as Record<string, unknown>)) {
    upstreams[name] = validateUpstreamConfig(name, upstream);
  }

  return {
    upstreams,
    logging: validateLoggingConfig(c.logging),
    baseDomain: typeof c.baseDomain === 'string' ? c.baseDomain : undefined,
  };
}
