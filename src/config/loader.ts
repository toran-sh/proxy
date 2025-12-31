import type { ProxyConfig, Runtime } from '../types/index.js';
import { validateProxyConfig } from './schema.js';

let cachedConfig: ProxyConfig | null = null;

export async function loadConfig(runtime: Runtime, envConfig?: string): Promise<ProxyConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  let rawConfig: unknown;

  if (envConfig) {
    try {
      rawConfig = JSON.parse(envConfig);
    } catch (e) {
      throw new Error(`Failed to parse PROXY_CONFIG env variable: ${e}`);
    }
  } else if (runtime === 'node' || runtime === 'vercel') {
    const fs = await import('fs');
    const path = await import('path');

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
        `Config file not found. Looked in: ${configPaths.join(', ')}`
      );
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    try {
      rawConfig = JSON.parse(configContent);
    } catch (e) {
      throw new Error(`Failed to parse config file ${configPath}: ${e}`);
    }
  } else {
    throw new Error(
      'Config must be provided via PROXY_CONFIG env variable for Cloudflare Workers'
    );
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
