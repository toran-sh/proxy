/**
 * Request/response log type definitions
 */

export interface Log {
  _id?: string;
  gatewayId: string;
  routeId: string | null;         // null if no route matched
  subdomain: string;

  request: {
    method: string;
    url: string;
    path: string;
    query: Record<string, string>;
    headers: Record<string, string>;  // Sanitized
    body: string;                     // Truncated if > 10KB
    bodySize: number;
    ip: string;
    userAgent: string;
    country?: string;
    region?: string;
    city?: string;
    pathParams?: Record<string, string>; // Extracted params
  };

  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;                     // Truncated if > 10KB
    bodySize: number;
  };

  execution: {
    routeMatched: boolean;
    routeName?: string;
    cacheHit: boolean;
    mutationsApplied: {
      pre: number;                    // Count of pre-mutations applied
      post: number;                   // Count of post-mutations applied
    };
    timing: {
      startedAt: Date;
      completedAt: Date;
      duration: number;               // Total duration in ms
      breakdown?: {
        routing: number;              // Time to match route
        preMutations: number;
        proxy: number;                // Actual proxy time
        postMutations: number;
        caching: number;
      };
    };
  };

  error?: {
    message: string;
    type: string;
    stack?: string;
    phase: 'routing' | 'pre-mutation' | 'proxy' | 'post-mutation' | 'caching';
  };

  createdAt: Date;
  expiresAt: Date;  // TTL: 30 days auto-delete
}

/**
 * Log query filters (for admin UI)
 */
export interface LogFilters {
  gatewayId?: string;
  subdomain?: string;
  startDate?: Date;
  endDate?: Date;
  statusCode?: number;
  method?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
