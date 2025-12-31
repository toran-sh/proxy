# Toran Proxy - Lightweight API Gateway Worker

Stateless, edge-deployed reverse proxy that reads gateway configurations from Cloudflare KV and forwards requests to backend services.

## Architecture

- **Reads**: Gateway configs from KV (populated by toran-www)
- **Writes**: Logs to toran-www via HTTP POST
- **Dependencies**: KV namespace only (no database access)

## Key Features

- 🚀 **Edge deployment** via Cloudflare Workers
- ⚡ **Sub-millisecond config reads** from KV
- 🔄 **Path-based routing** with regex matching
- 🎯 **Request/response mutations** (headers, body, query params)
- 💾 **Smart caching** with TTL and vary-by rules
- 📊 **Detailed logging** sent to toran-www

## Project Structure

```
toran-proxy/
├── src/
│   ├── index.ts              # Main entry point
│   ├── core/
│   │   ├── gateway-loader.ts # Load configs from KV
│   │   ├── router.ts         # Route matching
│   │   └── context-builder.ts
│   ├── mutations/
│   │   ├── engine.ts         # Mutation orchestrator
│   │   ├── header-mutator.ts
│   │   ├── query-mutator.ts
│   │   └── body-mutator.ts
│   ├── cache/
│   │   └── cache-manager.ts
│   ├── logging/
│   │   └── logger.ts         # POST logs to toran-www
│   └── proxy/
│       └── proxy-client.ts
├── shared/                   # Shared TypeScript types
└── wrangler.toml            # Cloudflare Worker config
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
wrangler secret put WWW_API_URL
# Enter: https://your-toran-www-deployment.pages.dev
```

**KV Namespace**: Already configured in `wrangler.toml` (GATEWAY_CONFIG binding)

### 3. Development

```bash
npm run dev
```

### 4. Deploy

```bash
npm run deploy
```

## Configuration

The proxy reads flattened gateway configurations from KV. Configs are written by toran-www when gateways are created/updated.

**KV Key Format**: `gateway:config:{subdomain}`

**Config Structure**:
```typescript
{
  id: string;
  subdomain: string;
  name: string;
  baseUrl: string;
  active: boolean;
  variables: Record<string, string>;
  routes: FlattenedRoute[];
  version: string;
}
```

## Logging

The proxy sends detailed logs to toran-www via HTTP POST to `/api/logs`:

```typescript
{
  subdomain: string;
  request: { method, url, headers, body, ... };
  response: { status, headers, body, ... };
  execution: {
    routeMatched: boolean;
    cacheHit: boolean;
    timing: { duration, breakdown };
  };
}
```

## Related Projects

- **toran-www**: Admin panel and API that manages MongoDB and writes configs to KV

## License

Private project - All rights reserved
