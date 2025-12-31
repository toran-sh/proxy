# Toran Proxy - Configuration Changes Summary

## What Changed

The Toran Proxy has been updated to use **API-based configuration loading** instead of Redis/KV storage.

### Before (Redis-based)
```
┌─────────────┐
│ Toran API   │──→ Redis ──→ ┌──────────┐
│   writes    │              │  Proxy   │
│   config    │              │  reads   │
└─────────────┘              └──────────┘
```

### After (API-based)
```
┌─────────────┐
│  Toran API  │←── HTTP GET ──┌──────────┐
│   Server    │               │  Proxy   │
│             │── Config ────→│  (cache) │
└─────────────┘               └──────────┘
```

## Architecture Changes

### Configuration Loading
- **Old:** Read from Redis (`gateway:config:{subdomain}`)
- **New:** Fetch from toran API (`GET /api/gateways/:subdomain`)
- **Caching:** In-memory cache with 60-second TTL

### Response Caching
- **Old:** Mandatory Redis (Cloudflare KV)
- **New:** Optional Redis (Upstash)
- **Behavior:** Disabled if Redis not configured

### Logging
- **Old:** POST to toran API
- **New:** Same (no change)

## Required toran API Endpoints

Your toran API deployment must implement:

### 1. GET /api/gateways/:subdomain
Returns the complete gateway configuration for a subdomain.

**Response:**
```json
{
  "id": "gw_123",
  "subdomain": "api",
  "name": "Production Gateway",
  "active": true,
  "variables": { "API_KEY": "xxx" },
  "routes": [
    {
      "_id": "route_1",
      "name": "Get User",
      "path": "/users/:id",
      "pathRegex": "^/users/([^/]+)$",
      "method": "GET",
      "destination": { "url": "https://api.example.com/users/${params.id}" },
      "cache": { "enabled": true, "ttl": 300 }
    }
  ]
}
```

### 2. POST /api/logs
Receives request/response logs (already implemented).

## Environment Variables

### Required
- `TORAN_API_URL` - URL of your toran API deployment

### Optional
- `UPSTASH_REDIS_REST_URL` - For response caching
- `UPSTASH_REDIS_REST_TOKEN` - For response caching
- `ENVIRONMENT` - Environment name

## Benefits

✅ **Simpler Architecture**
- No need to sync configs to Redis/KV
- Configs are always up-to-date (immediate consistency)
- One source of truth (toran API)

✅ **Lower Infrastructure Costs**
- Redis is optional (only for response caching)
- No KV storage costs
- Fewer services to manage

✅ **Better Developer Experience**
- Config changes are live immediately (after 60s cache)
- No manual sync or migration scripts
- Easier to debug (just check toran API)

✅ **Flexible Deployment**
- Can run without Redis
- Can deploy before Redis is set up
- Gracefully handles API failures (stale cache fallback)

## Trade-offs

⚠️ **Latency**
- First request: ~50-200ms (API call)
- Subsequent requests: <1ms (in-memory cache)
- KV was ~1-5ms consistently

⚠️ **API Dependency**
- Proxy depends on toran API availability
- If toran API is down, stale cache is used
- After stale cache expires, requests fail

⚠️ **Cache Invalidation**
- 60-second cache TTL (not instant)
- Manual cache clear only affects one instance
- Full invalidation requires waiting or redeployment

## Migration Steps

1. **Update toran API:**
   - Implement `GET /api/gateways/:subdomain` endpoint
   - Return gateway config in required format
   - Deploy toran-api

2. **Update toran-proxy:**
   - Code already updated (this repo)
   - Set `TORAN_API_URL` environment variable
   - (Optional) Set Redis variables for caching
   - Deploy to Vercel

3. **Verify:**
   - Test: `curl https://proxy.vercel.app?subdomain=test`
   - Check logs for "Gateway loaded" message
   - Monitor error rates

## Rollback Plan

If needed, you can rollback to Redis-based config:

1. Revert `src/core/gateway-loader.ts` to use Redis
2. Revert `src/index.ts` to require Redis
3. Set `REDIS_URL` environment variable
4. Redeploy

(The old code is preserved in git history)

## Files Modified

**Core Changes:**
- `src/core/gateway-loader.ts` - Now fetches from API with in-memory cache
- `src/index.ts` - Redis is optional, API URL is required
- `shared/src/types/index.ts` - Updated Env interface

**Configuration:**
- `package.json` - Dependencies updated
- `vercel.json` - Environment variables updated
- `.env.example` - Shows required variables
- `api/proxy.ts` - Entry point updated

**Documentation:**
- `README.md` - Added toran API specifications
- `MIGRATION.md` - Migration guide updated
- `DEPLOYMENT.md` - New deployment guide (created)
- `SUMMARY.md` - This file (created)

## Next Steps

1. **Implement toran API endpoints** (`GET /api/gateways/:subdomain`)
2. **Deploy toran-api** with the new endpoint
3. **Configure environment variables** in Vercel
4. **Deploy toran-proxy** to Vercel
5. **Test end-to-end** with a sample gateway
6. **Monitor logs** for any issues

## Questions?

- See `README.md` for API specifications
- See `DEPLOYMENT.md` for deployment instructions
- See `MIGRATION.md` for detailed migration guide
