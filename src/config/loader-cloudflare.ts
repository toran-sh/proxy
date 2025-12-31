import type { ProxyConfig } from '../types/index.js';
import { validateProxyConfig } from './schema.js';

let cachedConfig: ProxyConfig | null = null;

export function loadConfig(envConfig: string): ProxyConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  if (!envConfig) {
    throw new Error('PROXY_CONFIG env variable is required for Cloudflare Workers');
  }

  let rawConfig: unknown;
  try {
    rawConfig = JSON.parse(envConfig);
  } catch (e) {
    throw new Error(`Failed to parse PROXY_CONFIG env variable: ${e}`);
  }

  cachedConfig = validateProxyConfig(rawConfig);
  return cachedConfig;
}

export function getConfig(): ProxyConfig {
  if (!cachedConfig) {
    throw new Error('Config not loaded. Call loadConfig() first.');
  }
  return cachedConfig;
}

export function setConfig(config: ProxyConfig): void {
  cachedConfig = config;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}
