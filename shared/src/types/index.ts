/**
 * Shared type definitions for toran.dev API Accelerator & Debugger
 */

// Re-export all types
export * from './gateway';
export * from './route';
export * from './log';

/**
 * Redis client interface (compatible with @upstash/redis or ioredis)
 * Optional - only used for response caching if configured
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number; px?: number }): Promise<string | null>;
  del(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

/**
 * Environment bindings (Vercel/Edge Runtime)
 */
export interface Env {
  // Toran API URL - Required for fetching gateway configs and logging
  // Example: https://your-toran-api.vercel.app
  TORAN_API_URL: string;

  // Redis URL (Optional - only for response caching)
  // Format: redis://default:password@host:port or https://host (for Upstash REST)
  // If not provided, response caching will be disabled
  REDIS_URL?: string;
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
