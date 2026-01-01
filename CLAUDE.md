# Toran Proxy

Lightweight reverse proxy with zero runtime dependencies. Fetches configuration and sends logs via the Toran API.

## Commands

```bash
npm run dev    # Development with hot reload
npm run build  # Compile TypeScript
npm run start  # Run production server
```

## Project Structure

```
src/
├── server.ts           # Node.js HTTP server entry point
├── index.ts            # Main request handler (handleRequest)
├── routing/
│   └── subdomain.ts    # Extract subdomain from host or ?_sub_domain_= param
├── proxy/
│   ├── handler.ts      # Proxy logic, sends logs to API
│   └── headers.ts      # Header filtering (hop-by-hop, X-Forwarded-*)
└── types/
    └── index.ts        # TypeScript interfaces
```

## Request Flow

```
1. Request arrives
2. Extract subdomain (from host header or ?_sub_domain_= query param)
3. GET ${TORAN_API_URL}/${subdomain}/configuration → upstream config
4. Proxy request to upstream target
5. POST ${TORAN_API_URL}/${subdomain}/log → send request/response log
6. Return response with x-proxy-duration header
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TORAN_API_URL` | Yes | Base URL for config/logging API |
| `PORT` | No | Server port (default: 3000) |

## API Contracts

### GET /{subdomain}/configuration
Response:
```json
{
  "target": "https://api.example.com",
  "headers": {
    "add": { "X-Custom": "value" },
    "remove": ["X-Internal"]
  }
}
```

### POST /{subdomain}/log
Request body:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "request": { "method": "GET", "path": "/", "query": {}, "headers": {} },
  "response": { "status": 200, "headers": {}, "bodySize": 123 },
  "duration": 45
}
```

## Deployment

### Local Development
```bash
TORAN_API_URL=https://toran.sh/api npm run dev
curl "http://localhost:3000/health"
curl "http://localhost:3000/path?_sub_domain_=myapi"
```

### Docker
```bash
docker build -t toran-proxy .
docker run -p 8080:8080 -e TORAN_API_URL=https://toran.sh/api toran-proxy
```

### Fly.io
```bash
fly launch
fly secrets set TORAN_API_URL=https://toran.sh/api
fly deploy
```

### Vercel
Uses `api/index.ts` edge function. Set `TORAN_API_URL` in Vercel dashboard.

## Key Implementation Details

- **No runtime dependencies** - only devDependencies for TypeScript
- **Uses Web APIs** - Request, Response, Headers, fetch (Node.js 18+)
- **CORS enabled** - all origins allowed
- **Fire-and-forget logging** - logs sent async, doesn't block response
