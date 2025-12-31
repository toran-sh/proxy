# Migration Guide: Cloudflare Workers to Vercel Edge Runtime

This document outlines the changes made to migrate the Toran Proxy from Cloudflare Workers to Vercel Edge Runtime.

## Summary of Changes

### 1. Configuration Loading: KV → toran API

**Before (Cloudflare KV):**
```typescript
const config = await env.GATEWAY_CONFIG.get(key, 'json');
```

**After (toran API with in-memory cache):**
```typescript
const config = await GatewayLoader.load(subdomain, env);
// Fetches from: GET /api/gateways/:subdomain
// Cached in-memory for 60 seconds
```

### 2. Response Caching: KV → Redis (Optional)

**Before (Cloudflare KV):**
```typescript
await env.CACHE.put(key, value, { expirationTtl: ttl });
```

**After (Redis - Optional):**
```typescript
await redis.set(key, value, { ex: ttl });
// Only if REDIS_URL is configured
```

### 2. Runtime: Cloudflare Workers → Vercel Edge

**Before:**
```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(asyncTask());
    // ...
  }
}
```

**After:**
```typescript
export default async function handler(request: Request) {
  Promise.resolve().then(() => asyncTask());
  // ...
}
```

### 3. Environment Variables

**Before (wrangler.toml):**
```toml
[[kv_namespaces]]
binding = "GATEWAY_CONFIG"
id = "..."

[[kv_namespaces]]
binding = "CACHE"
id = "..."

[vars]
ENVIRONMENT = "production"
```

**After (Vercel Environment Variables):**
```bash
# Required
TORAN_API_URL=https://your-toran-api.vercel.app

# Optional (for response caching)
REDIS_URL=https://your-redis.upstash.io
REDIS_TOKEN=your-token

# Optional
ENVIRONMENT=production
```

**Redis URL Formats:**
- Upstash REST: `https://xxx.upstash.io` (requires `REDIS_TOKEN`)
- Standard Redis: `redis://user:password@host:port`

### 4. Deployment

**Before:**
```bash
npm run deploy  # wrangler deploy
```

**After:**
```bash
npm run deploy  # vercel --prod
# or connect GitHub repository to Vercel
```

## File Changes

### New Files

- `/api/proxy.ts` - Vercel Edge Function entry point
- `/src/lib/redis.ts` - Redis client wrapper (Upstash)
- `/vercel.json` - Vercel deployment configuration
- `/.env.example` - Environment variables template
- `/.vercelignore` - Vercel ignore file

### Modified Files

- `package.json` - Updated dependencies and scripts
- `tsconfig.json` - Updated for Vercel Edge Runtime
- `src/index.ts` - Changed from Cloudflare Worker export to function export
- `src/core/gateway-loader.ts` - KV → Redis
- `src/cache/cache-manager.ts` - KV → Redis
- `src/cache/invalidator.ts` - KV → Redis
- `src/core/context-builder.ts` - Cloudflare metadata → Vercel headers
- `shared/src/types/index.ts` - KVNamespace → RedisClient

### Removed Dependencies

- `@cloudflare/workers-types`
- `wrangler`

### Added Dependencies

- `@upstash/redis` - Edge-compatible Redis client
- `@vercel/edge` - Vercel Edge Runtime types
- `vercel` - Vercel CLI

## Breaking Changes

### 1. Async Task Handling

Cloudflare's `ctx.waitUntil()` is replaced with `Promise.resolve().then()`:

```typescript
// Before
ctx.waitUntil(Logger.logRequest(...));

// After
Promise.resolve().then(() => Logger.logRequest(...));
```

**Note:** Vercel Edge Functions have a maximum execution time of 30 seconds. Background tasks should complete within this window.

### 2. Geolocation Headers

**Before (Cloudflare):**
- `request.cf.country`
- `request.cf.region`
- `request.cf.city`

**After (Vercel):**
- `x-vercel-ip-country`
- `x-vercel-ip-country-region`
- `x-vercel-ip-city`

### 3. IP Address Detection

**Before:**
```typescript
ip: headers['cf-connecting-ip']
```

**After:**
```typescript
ip: headers['x-real-ip'] || headers['x-forwarded-for']
```

## Setup Instructions

### 1. Configure toran API URL (Required)

Set the `TORAN_API_URL` environment variable to your toran API deployment URL.

The toran API must implement these endpoints:
- `GET /api/gateways/:subdomain` - Returns gateway configuration
- `POST /api/logs` - Receives request/response logs

See README.md for full API specifications.

### 2. Create Redis Database (Optional - for response caching)

**Option A: Upstash (Recommended for Vercel)**
1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a new Redis database
3. Copy the REST URL and token
4. Set `REDIS_URL=https://xxx.upstash.io` and `REDIS_TOKEN=your-token`

**Option B: Standard Redis**
1. Set up any Redis instance (AWS ElastiCache, Redis Cloud, etc.)
2. Set `REDIS_URL=redis://user:password@host:port`

If you skip this step, response caching will be disabled but the proxy will still work.

### 3. Configure Vercel Environment Variables

In your Vercel project settings, add:

**Required:**
- `TORAN_API_URL`

**Optional:**
- `REDIS_URL` (for response caching)
- `REDIS_TOKEN` (for Upstash REST format)
- `ENVIRONMENT`

### 3. Deploy

```bash
# Install dependencies
npm install

# Deploy to Vercel
vercel --prod
```

## Data Migration

Gateway configurations are now fetched from the toran API instead of being stored in KV/Redis.

### Migration Steps:

1. **Update toran API** to implement the required API endpoints:
   - `GET /api/gateways/:subdomain`
   - `POST /api/logs`

2. **No data migration needed** - Configurations are fetched on-demand from the API

3. **Optional: Migrate cached responses** (if using Redis):
   - Old cache entries in KV can be ignored
   - New cache entries will be created in Redis as requests come in
   - Cache keys remain the same format: `cache:route:{routeId}:...`

## Performance Considerations

### Configuration Loading: KV vs API

| Feature | Cloudflare KV | toran API (Current) |
|---------|---------------|-------------------|
| Read Latency | ~1-5ms | ~50-200ms (first request) |
| Subsequent Reads | ~1-5ms | < 1ms (in-memory cache) |
| Cache TTL | N/A | 60 seconds |
| Consistency | Eventual | Immediate |
| API Calls | None | 1 per 60 seconds per subdomain |

### Response Caching: KV vs Redis

| Feature | Cloudflare KV | Upstash Redis |
|---------|---------------|---------------|
| Read Latency | ~1-5ms | ~5-15ms |
| Write Latency | ~100-500ms (eventual consistency) | ~5-15ms |
| Consistency | Eventual | Strong |
| Required | No | No (optional) |

### Recommendations

- **Gateway Config Cache:** The 60-second in-memory cache reduces API calls significantly
- **Response Cache:** Enable Redis for high-traffic routes with stable responses
- **Cache Invalidation:** Clear gateway config cache via API when configs change
- **Monitoring:** Track API call rates to toran API and Redis connection usage

## Testing

### Local Development

```bash
# Create .env file with test Redis credentials
cp .env.example .env

# Start Vercel dev server
npm run dev
```

### Testing Endpoints

```bash
# Test with subdomain via query param
curl http://localhost:3000?subdomain=test

# Test with hostname (requires DNS/hosts file)
curl http://test.localhost:3000
```

## Rollback Plan

If you need to rollback to Cloudflare Workers:

1. The `wrangler.toml` file is preserved
2. Revert changes to files marked "Modified" above
3. Run `npm install` to restore Cloudflare dependencies
4. Deploy with `wrangler deploy`

## Support

For issues or questions:
- Check [Vercel Edge Runtime docs](https://vercel.com/docs/functions/edge-functions)
- Check [Upstash Redis docs](https://docs.upstash.com/redis)
- Review this migration guide
