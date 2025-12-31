/**
 * Shared type definitions for toran.dev API Accelerator & Debugger
 */

// Re-export all types
export * from './gateway';
export * from './route';
export * from './log';

/**
 * KVNamespace type (from @cloudflare/workers-types)
 */
export interface KVNamespace {
  get(key: string, options?: { type: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<any>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: { expirationTtl?: number; expiration?: number; metadata?: any }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<any>;
}

/**
 * Cloudflare Worker environment bindings (Proxy)
 */
export interface Env {
  // Gateway config KV namespace (populated by WWW)
  // Key format: gateway:config:{subdomain}
  GATEWAY_CONFIG: KVNamespace;

  // WWW API URL for logging
  // Proxy sends logs to WWW endpoint
  WWW_API_URL?: string;

  // Environment
  ENVIRONMENT?: string;
}

/**
 * MongoDB Data API response structure
 */
export interface MongoDBDataAPIResponse<T> {
  document?: T;
  documents?: T[];
  insertedId?: string;
  matchedCount?: number;
  modifiedCount?: number;
  deletedCount?: number;
}

/**
 * Error response format
 */
export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
  timestamp: string;
}

// Legacy types (for backward compatibility during migration)
export interface Mapping {
  _id?: string;
  subdomain: string;
  destinationUrl: string;
  active: boolean;
  preservePath: boolean;
  metadata: {
    name: string;
    description: string;
    tags: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  stats: {
    totalRequests: number;
    lastRequestAt: Date | null;
  };
}
