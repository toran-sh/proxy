/**
 * Route and mutation type definitions
 */

export interface Route {
  _id?: string;
  gatewayId: string;

  // Route matching
  path: string;                   // "/users/:id" or "/api/*"
  method: string[];               // ["GET", "POST"] or ["*"]
  priority: number;               // Higher = evaluated first
  active: boolean;

  // Destination
  destination: {
    type: 'proxy' | 'redirect' | 'mock';
    url: string;                  // Template: "${BASE_URL}/v1/users/${params.id}"
    preservePath: boolean;
    overridePath?: string;
  };

  // Path parameters
  parameters: {
    [key: string]: {
      type: 'string' | 'number' | 'uuid';
      required: boolean;
      pattern?: string;           // Regex validation
      description?: string;
    };
  };

  // Pre-request mutations
  preMutations: PreMutations;

  // Post-response mutations
  postMutations: PostMutations;

  // Caching
  cache?: {
    enabled: boolean;
    ttl: number;                  // Seconds
    varyBy: {
      path: boolean;
      method: boolean;
      queryParams: string[];
      headers: string[];
      body: boolean;
    };
    conditions?: {
      statusCodes: number[];      // Only cache these statuses
      maxBodySize?: number;
    };
  };

  name: string;
  description: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  stats: {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    avgDuration: number;
    lastRequestAt: Date | null;
  };
}

/**
 * Pre-request mutations
 */
export interface PreMutations {
  headers?: HeaderMutation[];
  queryParams?: QueryParamMutation[];
  body?: BodyMutation[];
}

/**
 * Post-response mutations
 */
export interface PostMutations {
  headers?: HeaderMutation[];
  body?: BodyMutation[];
  status?: StatusMutation;
}

/**
 * Header mutation
 */
export interface HeaderMutation {
  type: 'add' | 'set' | 'remove' | 'rename';
  key: string;
  value?: string;                 // Template supported: "${request.headers['x-user-id']}"
  newKey?: string;                // For rename
  condition?: MutationCondition;
}

/**
 * Query parameter mutation
 */
export interface QueryParamMutation {
  type: 'add' | 'set' | 'remove' | 'rename';
  key: string;
  value?: string;                 // Template supported
  newKey?: string;
  condition?: MutationCondition;
}

/**
 * Body mutation (multiple transformation strategies)
 */
export interface BodyMutation {
  type: 'json-map' | 'json-path' | 'template' | 'function';

  // JSON Map - simple field mapping
  jsonMap?: {
    [sourceField: string]: string; // "user.name" -> "userName"
  };

  // JSONPath - advanced querying/transformation
  jsonPath?: {
    expression: string;           // "$.users[*].name"
    target?: string;              // Where to put result
  };

  // Template - string template with variables
  template?: string;              // "${body.firstName} ${body.lastName}"

  // JavaScript function - full control (sandboxed)
  function?: {
    code: string;                 // JavaScript code
    timeout: number;              // Max execution time (ms)
  };

  condition?: MutationCondition;
}

/**
 * Status code mutation
 */
export interface StatusMutation {
  type: 'override' | 'map';
  override?: number;              // Force specific status
  map?: {                         // Map status codes
    [originalStatus: string]: number; // "404": 200 (return 200 instead of 404)
  };
  condition?: MutationCondition;
}

/**
 * Mutation condition
 */
export interface MutationCondition {
  type: 'header' | 'query' | 'path' | 'method' | 'status' | 'expression';
  operator: 'equals' | 'contains' | 'matches' | 'exists' | 'gt' | 'lt';
  key?: string;
  value?: string;
  expression?: string;            // For complex conditions
}

/**
 * Flattened route for runtime (with compiled regex)
 */
export interface FlattenedRoute extends Route {
  pathRegex: string;              // Compiled path pattern as string (RegExp not JSON serializable)
  extractedParams?: Record<string, string>; // Extracted params during matching
}

/**
 * Create route request (from admin UI)
 */
export interface CreateRouteRequest {
  gatewayId: string;
  path: string;
  method: string[];
  priority?: number;
  active?: boolean;
  destination: Route['destination'];
  parameters?: Route['parameters'];
  preMutations?: PreMutations;
  postMutations?: PostMutations;
  cache?: Route['cache'];
  name: string;
  description: string;
  tags?: string[];
}

/**
 * Update route request (from admin UI)
 */
export interface UpdateRouteRequest extends Partial<CreateRouteRequest> {
  _id: string;
}
