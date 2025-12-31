/**
 * Gateway Loader - Loads gateway configurations from KV
 *
 * Architecture:
 * - WWW writes flattened gateway configs to KV when created/updated
 * - Proxy reads from KV only (no database access)
 * - Key format: gateway:config:{subdomain}
 */

import type { Env, FlattenedGateway } from '../../../shared/src/types';

const CONFIG_KEY_PREFIX = 'gateway:config:';

export class GatewayLoader {
  /**
   * Load gateway config from KV
   * Config is written by WWW when gateway is created/updated
   */
  static async load(subdomain: string, env: Env): Promise<FlattenedGateway | null> {
    const key = `${CONFIG_KEY_PREFIX}${subdomain}`;

    try {
      const config = await env.GATEWAY_CONFIG?.get(key, 'json');
      return config as FlattenedGateway | null;
    } catch (error) {
      console.error('Failed to load gateway config from KV:', error);
      return null;
    }
  }
}
