/**
 * Gateway type definitions
 */

export interface Gateway {
  _id?: string;
  subdomain: string;              // Unique (e.g., "api")
  name: string;
  description: string;
  baseUrl: string;                // Base destination URL
  active: boolean;

  // User-defined variables (API_KEY, BASE_URL, etc.)
  variables: {
    [key: string]: {
      value: string;
      description?: string;
      secret: boolean;            // Mask in UI/logs
    };
  };

  defaults: {
    timeout: number;
    followRedirects: boolean;
    cacheEnabled: boolean;
    logLevel: 'none' | 'basic' | 'full';
  };

  // Multi-tenancy (future)
  userId?: string;
  organizationId?: string;

  createdAt: Date;
  updatedAt: Date;
  stats: {
    totalRequests: number;
    totalRoutes: number;
    lastRequestAt: Date | null;
  };
}

import type { FlattenedRoute } from './route';

/**
 * Flattened gateway config for runtime (cached in KV)
 */
export interface FlattenedGateway {
  id: string;
  subdomain: string;
  active: boolean;
  variables: Record<string, string>;
  defaults: Gateway['defaults'];
  routes: FlattenedRoute[];
  version: string; // Config hash for cache invalidation
}

/**
 * Create gateway request (from admin UI)
 */
export interface CreateGatewayRequest {
  subdomain: string;
  name: string;
  description: string;
  baseUrl: string;
  active?: boolean;
  variables?: Gateway['variables'];
  defaults?: Partial<Gateway['defaults']>;
}

/**
 * Update gateway request (from admin UI)
 */
export interface UpdateGatewayRequest extends Partial<CreateGatewayRequest> {
  _id: string;
}
