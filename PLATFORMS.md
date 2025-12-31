# Multi-Platform Deployment Guide

Toran Proxy can be deployed to both **Vercel Edge Runtime** and **Cloudflare Workers**.

## Platform Comparison

| Feature | Vercel Edge | Cloudflare Workers |
|---------|-------------|-------------------|
| **Entry Point** | `api/proxy.ts` | `src/worker.ts` |
| **Runtime** | Vercel Edge Runtime | V8 Isolates |
| **Background Tasks** | `Promise.resolve()` | `ctx.waitUntil()` |
| **Deployment** | `vercel --prod` | `wrangler deploy` |
| **Free Tier** | 100GB bandwidth, 100k invocations | 100k requests/day |
| **Global Edge** | ✅ Yes | ✅ Yes |
| **Cold Start** | ~50-200ms | ~1-10ms |

## Quick Start

### Vercel Deployment

```bash
# Install dependencies
npm install

# Set environment variables
# .env or Vercel dashboard
TORAN_API_URL=https://your-toran-api.com
REDIS_URL=https://default:your-token@your-redis.upstash.io  # Optional

# Deploy
npm run deploy:vercel
```

### Cloudflare Workers Deployment

```bash
# Install dependencies
npm install

# Set secrets
wrangler secret put TORAN_API_URL
wrangler secret put REDIS_URL      # Optional (with embedded credentials)

# Deploy
npm run deploy:cloudflare
```

## Architecture

Both platforms share the same core logic with platform-specific adapters:

```
┌─────────────────────────────────────┐
│     Platform Entry Points          │
├─────────────────┬───────────────────┤
│  api/proxy.ts   │  src/worker.ts    │
│   (Vercel)      │  (Cloudflare)     │
└────────┬────────┴────────┬──────────┘
         │                 │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │  Platform       │
         │  Adapter        │
         │  (abstraction)  │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │  Core Logic     │
         │  (src/index.ts) │
         └─────────────────┘
```

## Development

### Local Development - Vercel

```bash
npm run dev:vercel
```

Access at: `http://localhost:3000`

### Local Development - Cloudflare

```bash
npm run dev:cloudflare
```

Access at: `http://localhost:8787`

## Environment Variables

Both platforms use the same environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `TORAN_API_URL` | ✅ Yes | URL of your toran API deployment |
| `REDIS_URL` | ⬜ No | Redis connection URL with embedded credentials (for caching) |

### Setting Variables

**Vercel:**
```bash
# Via Vercel Dashboard: Project Settings → Environment Variables
# Or via .env file for local development
```

**Cloudflare:**
```bash
wrangler secret put TORAN_API_URL
wrangler secret put REDIS_URL  # With embedded credentials
```

## Platform-Specific Features

### Vercel Edge Runtime

**Advantages:**
- Simple deployment via CLI or GitHub integration
- Automatic HTTPS and custom domains
- Built-in analytics and monitoring
- Great DX with preview deployments

**Limitations:**
- 30-second max execution time
- Background tasks not guaranteed to complete
- Limited to Vercel infrastructure

**Best for:**
- Teams already on Vercel
- Projects using Vercel's ecosystem
- Simple deployment workflows

### Cloudflare Workers

**Advantages:**
- Extremely fast cold starts (~1-10ms)
- Global edge network (200+ locations)
- `ctx.waitUntil()` for guaranteed background tasks
- More generous free tier (100k requests/day)

**Limitations:**
- Slightly more complex deployment
- Requires Cloudflare account
- Learning curve for Wrangler CLI

**Best for:**
- Performance-critical applications
- High-volume traffic
- Existing Cloudflare users
- Global distribution requirements

## Deployment Strategies

### 1. Single Platform (Recommended for most)

Choose one platform based on your needs:

- **Choose Vercel if:** You're already using Vercel, want simple deployment, or need preview deployments
- **Choose Cloudflare if:** You need best performance, have high traffic, or want the generous free tier

### 2. Multi-Platform (Advanced)

Deploy to both platforms for redundancy:

```bash
# Deploy to Vercel
npm run deploy:vercel

# Deploy to Cloudflare
npm run deploy:cloudflare
```

Use DNS failover or load balancing to route traffic between platforms.

### 3. Hybrid Approach

- **Production:** Cloudflare Workers (performance)
- **Staging/Preview:** Vercel Edge (DX)

## Migration Between Platforms

### Vercel → Cloudflare

1. Install Cloudflare dependencies (already in package.json)
2. Set Cloudflare secrets: `wrangler secret put TORAN_API_URL`
3. Deploy: `npm run deploy:cloudflare`
4. Update DNS to point to Cloudflare

### Cloudflare → Vercel

1. Install Vercel dependencies (already in package.json)
2. Set environment variables in Vercel dashboard
3. Deploy: `npm run deploy:vercel`
4. Update DNS to point to Vercel

## Testing

### Test Vercel Deployment

```bash
curl https://your-project.vercel.app?subdomain=test
```

### Test Cloudflare Deployment

```bash
curl https://your-worker.workers.dev?subdomain=test
```

## Cost Comparison

### Vercel

**Free Tier:**
- 100GB bandwidth/month
- 100k Edge Function invocations/month
- Unlimited deployments

**Pro ($20/month):**
- 1TB bandwidth
- Unlimited invocations
- Advanced analytics

### Cloudflare Workers

**Free Tier:**
- 100k requests/day (3M/month)
- 10ms CPU time per request
- Unlimited deployments

**Paid ($5/month):**
- 10M requests/month included
- $0.50 per additional 1M requests
- 50ms CPU time per request

### Cost Winner

For most use cases: **Cloudflare Workers** (3x more requests in free tier)

## Monitoring

### Vercel

- Built-in analytics in dashboard
- Real-time logs: `vercel logs --follow`
- Integration with monitoring tools (Sentry, Datadog, etc.)

### Cloudflare

- Workers Analytics dashboard
- Real-time logs: `wrangler tail`
- Integration with Cloudflare Analytics

## Support

- **Vercel:** [vercel.com/support](https://vercel.com/support)
- **Cloudflare:** [developers.cloudflare.com](https://developers.cloudflare.com)

## FAQ

**Q: Can I use the same codebase for both platforms?**
A: Yes! The codebase is platform-agnostic with platform-specific entry points.

**Q: Do I need to maintain separate configurations?**
A: Mostly no. Only entry points and deployment configs differ.

**Q: Can I switch platforms later?**
A: Yes, switching is straightforward since the core logic is shared.

**Q: Which platform is faster?**
A: Cloudflare Workers have faster cold starts (~1-10ms vs ~50-200ms).

**Q: Which platform is cheaper?**
A: Cloudflare Workers offer a more generous free tier (3M requests vs 100k invocations).

**Q: Can I deploy to both simultaneously?**
A: Yes, you can deploy to both and use DNS to route traffic.
