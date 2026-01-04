# Toran Proxy

Lightweight reverse proxy deployed as Vercel Edge Function. Fetches configuration and sends logs via the Toran WWW API.

## Architecture

Two separate applications work together:
- **toran-www**: Next.js dashboard & API (configuration + logging endpoints)
- **toran-proxy**: Edge proxy that calls www API endpoints

## Commands

```bash
npm run dev    # Development with hot reload
npm run build  # Compile TypeScript
npm run start  # Run production server (Node.js)
npm run test   # Run tests
```

## Project Structure

```
src/
├── index.ts            # Main request handler (handleRequest), config fetching
├── server.ts           # Node.js HTTP server entry point (local dev)
├── cache/
│   └── index.ts        # Cache abstraction (Upstash HTTP or ioredis TCP)
├── routing/
│   └── subdomain.ts    # Extract subdomain from host or ?_sub_domain_= param
├── proxy/
│   ├── handler.ts      # Proxy logic, response caching, sends logs
│   └── headers.ts      # Header filtering (hop-by-hop, X-Forwarded-*, strips server headers)
└── types/
    └── index.ts        # TypeScript interfaces (UpstreamConfig, RequestLog, etc.)

api/
└── index.ts            # Vercel Edge Function entry point
```

## Request Flow

```
1. Request arrives at Edge Function
2. Extract subdomain (from host header or ?_sub_domain_= query param)
3. Check config cache (Upstash/Redis)
4. If cache miss: GET ${TORAN_API_URL}/api/${subdomain}/configuration
5. Cache config based on Cache-Control max-age header (60 seconds)
6. Check response cache if cacheTtl configured
7. If cache miss: Proxy request to upstream target
8. Cache response if cacheTtl > 0 and response.ok
9. POST ${TORAN_API_URL}/api/${subdomain}/log (fire-and-forget)
10. Return response to client
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TORAN_API_URL` | Yes | Base URL for toran-www API (e.g., https://toran.sh) |
| `UPSTASH_REDIS_REST_URL` | For Edge | Upstash Redis REST URL (HTTP-based) |
| `UPSTASH_REDIS_REST_TOKEN` | For Edge | Upstash Redis REST token |
| `REDIS_URL` | For Node.js | Redis connection URL for ioredis (TCP) |
| `PORT` | No | Server port for local dev (default: 3000) |

## Caching

### Cache Priority
1. If `UPSTASH_REDIS_REST_URL` set → Use Upstash (HTTP, works on Edge)
2. Else if `REDIS_URL` set → Use ioredis (TCP, Node.js only)
3. Else → No caching

### Cache Keys
- Config: `toran:config:{subdomain}`
- Response: `toran:{subdomain}:{method}:{path}{query}`

### Cache TTLs
- Config: Based on Cache-Control header from www API (default 60s)
- Response: Based on `cacheTtl` field in gateway configuration

## API Contracts (with toran-www)

### GET /api/{subdomain}/configuration
Response (Cache-Control: public, max-age=60):
```json
{
  "upstreamBaseUrl": "https://api.example.com",
  "cacheTtl": 300
}
```

### POST /api/{subdomain}/log
Request body:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "request": { "method": "GET", "path": "/", "query": {}, "headers": {}, "bodySize": 0 },
  "response": { "status": 200, "headers": {}, "bodySize": 123 },
  "duration": 45,
  "timing": {
    "clientToProxy": { "transfer": 0 },
    "upstreamToProxy": { "ttfb": 30, "transfer": 10 },
    "total": 45
  },
  "cacheStatus": "MISS"
}
```

Timing segments:
- **clientToProxy.transfer**: Time to read incoming request body (ms)
- **upstreamToProxy.ttfb**: Time to first byte from upstream (ms)
- **upstreamToProxy.transfer**: Time to read upstream response body (ms)
- **total**: End-to-end duration (ms)

## Deployment

### Vercel (Edge Function)
- Uses `api/index.ts` with `runtime: 'edge'`
- Set env vars in Vercel dashboard
- `vercel.json` configured with empty buildCommand, outputDirectory: "."
- ioredis excluded from Edge bundle via string concatenation trick (`'io' + 'redis'`)

### Local Development
```bash
# With Upstash
TORAN_API_URL=https://toran.sh UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... npm run dev

# With local Redis
TORAN_API_URL=https://toran.sh REDIS_URL=redis://localhost:6379 npm run dev

# Test endpoints
curl "http://localhost:3000/path?_sub_domain_=myapi"
```

### Docker
```bash
docker build -t toran-proxy .
docker run -p 8080:8080 -e TORAN_API_URL=https://toran.sh -e REDIS_URL=redis://host:6379 toran-proxy
```

### Fly.io
```bash
fly launch
fly secrets set TORAN_API_URL=https://toran.sh REDIS_URL=redis://...
fly deploy
```

## Key Implementation Details

- **Edge-first**: Deployed as Vercel Edge Function for low latency
- **Dual cache backends**: Upstash (HTTP) for Edge, ioredis (TCP) for Node.js
- **Dynamic import trick**: `'io' + 'redis'` prevents Edge bundler from analyzing ioredis
- **CORS enabled**: All origins allowed
- **Fire-and-forget logging**: Logs sent async, doesn't block response
- **Header stripping**: Removes x-powered-by, server from upstream responses
- **Config caching**: Respects Cache-Control header from www API

## Types

```typescript
interface UpstreamConfig {
  upstreamBaseUrl: string;
  cacheTtl?: number;
  logResponseBody?: boolean;
  headers?: {
    add?: Record<string, string>;
    remove?: string[];
  };
}

interface TimingMetrics {
  clientToProxy: { transfer: number };   // Segment 1: read request body
  upstreamToProxy: { ttfb: number; transfer: number };  // Segment 3: upstream response
  total: number;  // End-to-end
}

interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}
```
