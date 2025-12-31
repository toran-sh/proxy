/**
 * Worker-specific types for toran project
 */

import type { Mapping, Log } from '../../shared/types';

export type { Mapping, Log };

/**
 * Parsed subdomain information
 */
export interface SubdomainInfo {
  subdomain: string;
  hostname: string;
  isValid: boolean;
}

/**
 * Proxy request context
 */
export interface ProxyContext {
  request: Request;
  mapping: Mapping;
  startTime: number;
  subdomain: string;
}

/**
 * Proxy result
 */
export interface ProxyResult {
  response: Response;
  timing: {
    startedAt: Date;
    completedAt: Date;
    duration: number;
  };
  error?: {
    message: string;
    type: string;
    stack?: string;
  };
}
