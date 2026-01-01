# Toran Proxy

API Accelerator & Debugger - A lightweight reverse proxy with zero runtime dependencies.

## Quick Commands

```bash
npm run dev    # Local development with hot reload
npm run build  # TypeScript compilation
npm run start  # Run compiled app
```

## Architecture

```
Request → Extract Subdomain → Fetch Config from API → Proxy to Upstream → Log to API
```

## How It Works

1. **Subdomain Routing**: Extracts subdomain from host header or `?_sub_domain_=` param
2. **Config from API**: Fetches upstream config from `https://toran.sh/api/<subdomain>/configuration`
3. **Proxy Request**: Forwards request to configured upstream target
4. **Log to API**: POSTs request/response log to `https://toran.sh/api/<subdomain>/log`

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main request handler, fetches config from API |
| `src/server.ts` | Node.js HTTP server |
| `src/proxy/handler.ts` | Proxies requests, sends logs to API |
| `src/proxy/headers.ts` | Header filtering and forwarding |
| `src/routing/subdomain.ts` | Subdomain extraction |

## API Endpoints Used

### GET /api/{subdomain}/configuration
Returns upstream configuration:
```json
{
  "target": "https://api.example.com",
  "headers": {
    "add": { "X-Proxy": "toran" },
    "remove": ["X-Internal-Token"]
  }
}
```

### POST /api/{subdomain}/log
Receives request logs:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "request": {
    "method": "GET",
    "path": "/users",
    "query": {},
    "headers": {},
    "body": null
  },
  "response": {
    "status": 200,
    "headers": {},
    "bodySize": 1234
  },
  "duration": 150
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `TORAN_API_URL` | API base URL for config/logging |

## Deployment

### Docker
```bash
docker build -t toran-proxy .
docker run -p 8080:8080 -e TORAN_API_URL=https://toran.sh/api toran-proxy
```

### Fly.io
```bash
fly launch        # First time setup
fly secrets set TORAN_API_URL=https://toran.sh/api
fly deploy        # Deploy
```

## Response Headers

The proxy adds:
- `x-proxy-duration: Xms` - Request processing time
