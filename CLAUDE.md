# Toran Proxy

A reverse proxy service built with Hono + TypeScript that runs on Node.js and Vercel.

## Quick Commands

```bash
npm run dev          # Local development with hot reload
npm run build        # TypeScript compilation
npm run start        # Run compiled app
npm run deploy:vercel # Deploy to Vercel
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
| `src/index.ts` | Main Hono app factory |
| `src/proxy/handler.ts` | Core proxy logic - forwards requests, handles caching/logging |
| `src/routing/subdomain.ts` | Extracts subdomain from host or `_sub_domain_` param |
| `src/cache/matcher.ts` | Pattern matching for cache rules (glob, headers, query, body) |
| `src/cache/redis.ts` | Redis wrapper using ioredis |
| `src/logging/mongodb.ts` | MongoDB logger using native driver |
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

## Environment Variables

```
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=toran_proxy
REDIS_URL=redis://...
```

## Entry Points

- `src/entry-node.ts` - Node.js with `@hono/node-server`
- `src/entry-vercel.ts` - Vercel with `hono/vercel` adapter

## Response Headers

The proxy adds:
- `x-proxy-cache: HIT|MISS` - Whether response was served from cache
- `x-proxy-duration: Xms` - Total request processing time
