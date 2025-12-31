# Toran Proxy

A reverse proxy service built with Hono + TypeScript that runs on Node.js, Vercel, and Cloudflare Workers.

## Quick Commands

```bash
npm run dev          # Local development with hot reload
npm run build        # TypeScript compilation
npm run deploy:vercel # Deploy to Vercel
npm run deploy:cf    # Deploy to Cloudflare Workers
npm run cf:dev       # Local CF Workers dev
```

## Architecture

```
Request → Subdomain Router → Cache Check → Upstream Fetch → Response
                                 ↓              ↓
                            Redis Cache    MongoDB Log
```

## Subdomain Routing

- **Production**: Subdomain from Host header (`api.toran.sh` → config key `api`)
- **Localhost**: Query param `?_sub_domain_=api` determines config

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main Hono app, creates platform-agnostic app |
| `src/proxy/handler.ts` | Core proxy logic - forwards requests, handles caching/logging |
| `src/routing/subdomain.ts` | Extracts subdomain from host or `_sub_domain_` param |
| `src/cache/matcher.ts` | Pattern matching for cache rules (glob, headers, query, body) |
| `src/cache/redis.ts` | Redis wrapper - uses ioredis (Node/Vercel) or Upstash (CF Workers) |
| `src/logging/mongodb.ts` | MongoDB logger - uses driver (Node/Vercel) or Atlas Data API (CF Workers) |
| `src/config/loader.ts` | Loads config from file or PROXY_CONFIG env var |
| `config/proxy.json` | Proxy configuration with upstreams and cache rules |

## Configuration Schema

```json
{
  "upstreams": {
    "api": {
      "target": "https://api.example.com",
      "cacheRules": [
        {
          "match": { "path": "/v1/*", "method": "GET" },
          "ttl": 3600
        }
      ],
      "headers": {
        "add": { "X-Proxy": "toran" },
        "remove": ["X-Internal-Token"]
      }
    }
  },
  "logging": {
    "enabled": true,
    "excludePaths": ["/health"]
  },
  "baseDomain": "toran.sh"
}
```

## Cache Rule Matching

Supports pattern matching on:
- `path`: Glob patterns (`/api/*`, `**/*.json`)
- `method`: Exact match (`GET`, `POST`)
- `headers`: Key-value with wildcards
- `query`: Query param patterns
- `body`: JSON path matching for request bodies

## Platform Differences

| Feature | Node.js/Vercel | Cloudflare Workers |
|---------|----------------|-------------------|
| Redis | `ioredis` (TCP) | `@upstash/redis` (HTTP) |
| MongoDB | `mongodb` driver | Atlas Data API (HTTP) |
| Config | File system | `PROXY_CONFIG` env var |

## Environment Variables

```
# Node.js / Vercel
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=toran_proxy
REDIS_URL=redis://...

# Cloudflare Workers (HTTP-based)
MONGODB_DATA_API_URL=https://data.mongodb-api.com/...
MONGODB_DATA_API_KEY=...
UPSTASH_REDIS_URL=https://...
UPSTASH_REDIS_TOKEN=...
PROXY_CONFIG={"upstreams": {...}}
```

## Entry Points

- `src/entry-node.ts` - Node.js with `@hono/node-server`
- `src/entry-vercel.ts` - Vercel Edge with `hono/vercel` adapter
- `src/entry-cloudflare.ts` - CF Workers (native Hono export)

## Response Headers

The proxy adds:
- `x-proxy-cache: HIT|MISS` - Whether response was served from cache
- `x-proxy-duration: Xms` - Total request processing time
