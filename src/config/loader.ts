import fs from 'fs';
import path from 'path';
import type { ProxyConfig } from '../types/index.js';
import { validateProxyConfig } from './schema.js';

let cachedConfig: ProxyConfig | null = null;

export function loadConfig(): ProxyConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Check for PROXY_CONFIG env var first
  const envConfig = process.env.PROXY_CONFIG;
  if (envConfig) {
    try {
      const rawConfig = JSON.parse(envConfig);
      cachedConfig = validateProxyConfig(rawConfig);
      return cachedConfig;
    } catch (e) {
      throw new Error(`Failed to parse PROXY_CONFIG env variable: ${e}`);
    }
  }

  // Load from file
  const configPaths = [
    path.join(process.cwd(), 'config', 'proxy.json'),
    path.join(process.cwd(), 'proxy.json'),
  ];

  let configPath: string | null = null;
  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }

  if (!configPath) {
    throw new Error(
      `Config file not found. Looked in: ${configPaths.join(', ')}. ` +
      `Alternatively, set the PROXY_CONFIG environment variable.`
    );
  }

  const configContent = fs.readFileSync(configPath, 'utf-8');
  try {
    const rawConfig = JSON.parse(configContent);
    cachedConfig = validateProxyConfig(rawConfig);
    return cachedConfig;
  } catch (e) {
    throw new Error(`Failed to parse config file ${configPath}: ${e}`);
  }
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
