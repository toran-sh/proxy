# Toran Proxy - Lightweight API Gateway Worker

Stateless, edge-deployed reverse proxy that reads gateway configurations from toran API and forwards requests to backend services.

**Multi-Platform Support:** Deploy to Vercel Edge Runtime or Cloudflare Workers with the same codebase.

## Architecture

- **Reads**: Gateway configs from toran API (with in-memory caching)
- **Writes**: Logs to toran API via HTTP POST
- **Optional**: Redis for response caching (can be disabled)
- **Platforms**: Vercel Edge Runtime or Cloudflare Workers

## Key Features

- 🚀 **Multi-platform deployment** - Vercel Edge or Cloudflare Workers
- ⚡ **Fast config reads** from toran API (60s in-memory cache)
- 🔄 **Path-based routing** with regex matching
- 🎯 **Request/response mutations** (headers, body, query params)
- 💾 **Smart response caching** with optional Redis backend
- 📊 **Detailed logging** sent to toran API

## Project Structure

```
toran-proxy/
├── api/
│   └── proxy.ts              # Vercel Edge Function entry point
├── src/
│   ├── worker.ts             # Cloudflare Workers entry point
│   ├── index.ts              # Core handler logic (platform-agnostic)
│   ├── platform/
│   │   ├── adapter.ts        # Platform abstraction layer
│   │   └── types.ts          # Platform-specific types
│   ├── lib/
│   │   └── redis.ts          # Redis client (optional - supports multiple formats)
│   ├── core/
│   │   ├── gateway-loader.ts # Load configs from toran API
│   │   ├── router.ts         # Route matching
│   │   └── context-builder.ts
│   ├── mutations/
│   │   ├── engine.ts         # Mutation orchestrator
│   │   ├── header-mutator.ts
│   │   ├── query-mutator.ts
│   │   └── body-mutator.ts
│   ├── cache/
│   │   └── cache-manager.ts  # Redis-based caching
│   ├── logging/
│   │   └── logger.ts         # POST logs to toran-api
│   └── proxy/
│       └── proxy-client.ts
├── shared/                   # Shared TypeScript types
├── vercel.json              # Vercel deployment config
└── wrangler.toml            # Cloudflare Workers config
```

## Platform Choice

**Choose Vercel if:**
- ✅ You're already using Vercel
- ✅ You want simple deployment via CLI or GitHub
- ✅ You need preview deployments

**Choose Cloudflare if:**
- ✅ You need best performance (faster cold starts)
- ✅ You have high-volume traffic
- ✅ You want a generous free tier (100k requests/day)

See [PLATFORMS.md](./PLATFORMS.md) for detailed comparison.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Required
TORAN_API_URL=https://your-toran-api-deployment.com

# Optional (for response caching)
REDIS_URL=https://default:your-token@your-redis-instance.upstash.io
```

**Redis URL Formats:**
- Upstash REST: `https://default:your-token@your-redis-instance.upstash.io`
- Standard Redis: `redis://default:password@host:port`

**Note:** Redis is optional. If not configured, response caching will be disabled but the proxy will still work.

For Vercel deployment, set these as environment variables in the Vercel dashboard.

### 3. Development

**Vercel:**
```bash
npm run dev:vercel
# Access at http://localhost:3000
```

**Cloudflare:**
```bash
npm run dev:cloudflare
# Access at http://localhost:8787
```

### 4. Deploy

**Vercel:**
```bash
npm run deploy:vercel
# Or connect GitHub to Vercel for automatic deployments
```

**Cloudflare:**
```bash
# Set secrets first
wrangler secret put TORAN_API_URL
wrangler secret put REDIS_URL      # Optional (with embedded credentials)

# Deploy
npm run deploy:cloudflare
```

See [PLATFORMS.md](./PLATFORMS.md) for detailed deployment instructions.

## toran API Integration

The proxy communicates with the toran API for both configuration loading and logging.

### API Endpoints Required

The toran API must implement the following endpoints:

#### 1. Get Gateway Configuration

**Endpoint:** `GET /api/gateways/:subdomain`

**Description:** Returns the flattened gateway configuration for a subdomain

**Response (200 OK):**
```typescript
{
  id: string;                          // Gateway ID
  subdomain: string;                   // Gateway subdomain
  name: string;                        // Gateway name
  baseUrl: string;                     // Base URL (deprecated, use route destinations)
  active: boolean;                     // Whether gateway is active
  variables: Record<string, string>;   // Gateway-level variables (e.g., API_KEY: "xxx")
  routes: FlattenedRoute[];            // Array of routes
  version: string;                     // Config version (for cache busting)
}
```

**FlattenedRoute Structure:**
```typescript
{
  _id: string;                         // Route ID
  name: string;                        // Route name
  path: string;                        // Path pattern (e.g., "/users/:id")
  pathRegex: string;                   // Compiled regex for matching
  method: string;                      // HTTP method (GET, POST, etc.)
  destination: {
    url: string;                       // Destination URL (supports ${variables})
  };
  cache?: {
    enabled: boolean;                  // Whether caching is enabled
    ttl: number;                       // Cache TTL in seconds
    varyBy?: string[];                 // Vary cache by fields (e.g., ["query.page"])
    statusCodes?: number[];            // Only cache these status codes
  };
  mutations?: {
    pre?: Mutation[];                  // Pre-request mutations
    post?: Mutation[];                 // Post-response mutations
  };
}
```

**Response (404 Not Found):**
```json
{
  "error": {
    "code": "GATEWAY_NOT_FOUND",
    "message": "Gateway not found"
  }
}
```

**Caching:** The proxy caches configurations in-memory for 60 seconds to reduce API calls.

---

#### 2. Create Log Entry

**Endpoint:** `POST /api/logs`

**Description:** Receives detailed request/response logs from the proxy

**Request Body:**
```typescript
{
  gatewayId: string;                   // Gateway ID
  routeId: string | null;              // Route ID (null if no route matched)
  subdomain: string;                   // Gateway subdomain

  request: {
    method: string;                    // HTTP method
    url: string;                       // Full URL
    path: string;                      // URL path
    query: Record<string, string>;     // Query parameters
    headers: Record<string, string>;   // Request headers (sensitive headers redacted)
    body: string;                      // Request body (truncated if > 10KB)
    bodySize: number;                  // Original body size
    ip: string;                        // Client IP
    userAgent: string;                 // User agent
    country?: string;                  // Client country (from edge headers)
    region?: string;                   // Client region
    city?: string;                     // Client city
    pathParams: Record<string, string>; // Extracted path parameters
  };

  response: {
    status: number;                    // HTTP status code
    statusText: string;                // Status text
    headers: Record<string, string>;   // Response headers
    body: string;                      // Response body (truncated if > 10KB)
    bodySize: number;                  // Original body size
  };

  execution: {
    routeMatched: boolean;             // Whether a route was matched
    routeName?: string;                // Matched route name
    cacheHit: boolean;                 // Whether response came from cache
    mutationsApplied: {
      pre: number;                     // Number of pre-request mutations applied
      post: number;                    // Number of post-response mutations applied
    };
    timing: {
      startedAt: Date;                 // Request start time
      completedAt: Date;               // Request completion time
      duration: number;                // Total duration in ms
      breakdown?: {
        routing: number;               // Routing time in ms
        preMutations?: number;         // Pre-mutation time in ms
        proxy: number;                 // Proxy time in ms
        postMutations?: number;        // Post-mutation time in ms
        caching?: number;              // Caching time in ms
      };
    };
  };

  error?: {
    message: string;                   // Error message
    type: string;                      // Error type
    stack?: string;                    // Stack trace
    phase: string;                     // Phase where error occurred
  };
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "logId": "log_123..."
}
```

**Error Handling:** The proxy does not fail if logging fails. Logs are sent asynchronously via `Promise.resolve().then()`.

---

### Configuration Structure Example

Complete example of a gateway configuration returned by `GET /api/gateways/:subdomain`:

```json
{
  "id": "gw_abc123",
  "subdomain": "api",
  "name": "Production API Gateway",
  "baseUrl": "https://api.example.com",
  "active": true,
  "variables": {
    "API_KEY": "sk_live_...",
    "BASE_URL": "https://api.example.com"
  },
  "routes": [
    {
      "_id": "route_123",
      "name": "Get User",
      "path": "/users/:id",
      "pathRegex": "^/users/([^/]+)$",
      "method": "GET",
      "destination": {
        "url": "https://api.example.com/v1/users/${params.id}"
      },
      "cache": {
        "enabled": true,
        "ttl": 300,
        "varyBy": ["query.fields"],
        "statusCodes": [200]
      },
      "mutations": {
        "pre": [
          {
            "type": "add_header",
            "target": "Authorization",
            "value": "Bearer ${variables.API_KEY}"
          }
        ],
        "post": [
          {
            "type": "remove_header",
            "target": "X-Internal-Token"
          }
        ]
      }
    }
  ],
  "version": "1.0.0"
}
```

## Caching

The proxy implements two levels of caching:

### 1. Gateway Configuration Cache (In-Memory)
- **TTL:** 60 seconds
- **Purpose:** Reduce API calls to toran API for config fetching
- **Fallback:** If API fails, stale cache is used
- **Storage:** In-memory (per Edge Function instance)

### 2. Response Cache (Optional - Redis)
- **TTL:** Configurable per route (e.g., 300 seconds)
- **Purpose:** Cache proxied responses based on route config
- **Storage:** Redis (Upstash recommended)
- **Disabled:** If `REDIS_URL` is not configured

### Cache Invalidation

To invalidate the in-memory gateway configuration cache, you can call the cache clearing utility:

```typescript
import { GatewayLoader } from './src/core/gateway-loader';

// Clear cache for a specific subdomain
GatewayLoader.clearCache('api');

// Clear all cached configs
GatewayLoader.clearCache();
```

**Note:** Since Vercel Edge Functions are serverless and distributed, clearing the cache affects only the specific instance. For full invalidation across all instances, wait for the 60-second TTL to expire or trigger a redeployment.

## Documentation

- **[PLATFORMS.md](./PLATFORMS.md)** - Detailed platform comparison and deployment guide
- **[MULTI_PLATFORM_SUMMARY.md](./MULTI_PLATFORM_SUMMARY.md)** - Quick overview of multi-platform support
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Vercel deployment guide
- **[MIGRATION.md](./MIGRATION.md)** - Migration from Cloudflare KV to API-based config
- **[SUMMARY.md](./SUMMARY.md)** - Architecture changes summary

## Related Projects

- **toran-api**: Admin panel and API that manages MongoDB and provides API endpoints for proxy

## License

Private project - All rights reserved
