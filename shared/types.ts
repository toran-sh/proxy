/**
 * Shared TypeScript types for toran project
 */

/**
 * Subdomain to destination mapping
 */
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

/**
 * Request/response log entry
 */
export interface Log {
  _id?: string;
  subdomain: string;
  mappingId: string;
  request: {
    method: string;
    url: string;
    path: string;
    query: Record<string, string>;
    headers: Record<string, string>;
    body: string;
    bodySize: number;
    ip: string;
    userAgent: string;
    country?: string;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    bodySize: number;
  };
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
  createdAt: Date;
}

/**
 * Cloudflare Worker environment bindings
 */
export interface Env {
  // MongoDB configuration
  MONGODB_API_URL: string;
  MONGODB_API_KEY: string;
  MONGODB_DATABASE: string;

  // Optional KV cache for mappings
  CACHE?: KVNamespace;

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
 * Create mapping request (from admin webapp)
 */
export interface CreateMappingRequest {
  subdomain: string;
  destinationUrl: string;
  active?: boolean;
  preservePath?: boolean;
  metadata: {
    name: string;
    description: string;
    tags?: string[];
  };
}

/**
 * Update mapping request (from admin webapp)
 */
export interface UpdateMappingRequest extends Partial<CreateMappingRequest> {
  _id: string;
}

/**
 * Log query filters (for admin webapp)
 */
export interface LogFilters {
  subdomain?: string;
  startDate?: Date;
  endDate?: Date;
  statusCode?: number;
  method?: string;
  search?: string;
  limit?: number;
  offset?: number;
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
