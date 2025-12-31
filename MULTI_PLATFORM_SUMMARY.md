# Multi-Platform Support - Summary

The Toran Proxy now supports deployment to **both Vercel Edge Runtime and Cloudflare Workers** using the same codebase.

## What Changed

### ✅ Platform Abstraction Layer

**New Files:**
- `src/platform/types.ts` - Platform-specific types
- `src/platform/adapter.ts` - Platform detection and context creation
- `src/worker.ts` - Cloudflare Workers entry point

**Updated Files:**
- `api/proxy.ts` - Vercel entry point (updated to use platform context)
- `src/index.ts` - Core handler (now platform-agnostic)
- `package.json` - Added scripts for both platforms
- `tsconfig.json` - Added Cloudflare Workers types
- `wrangler.toml` - Updated for API-based config loading

### ✅ Key Improvements

1. **Unified Codebase**: Same core logic for both platforms
2. **Platform Detection**: Automatic detection of runtime environment
3. **Abstracted Background Tasks**:
   - Vercel: `Promise.resolve().then()`
   - Cloudflare: `ctx.waitUntil()`
4. **Single Configuration**: Same environment variables for both

## Architecture

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
         │  Context        │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │  Core Logic     │
         │  (index.ts)     │
         └─────────────────┘
```

## Deployment Commands

### Vercel
```bash
npm run dev:vercel        # Local development
npm run deploy:vercel     # Production deployment
```

### Cloudflare
```bash
npm run dev:cloudflare    # Local development
npm run deploy:cloudflare # Production deployment
```

## Platform Comparison

| Feature | Vercel | Cloudflare |
|---------|--------|------------|
| **Entry Point** | `api/proxy.ts` | `src/worker.ts` |
| **Dev Command** | `npm run dev:vercel` | `npm run dev:cloudflare` |
| **Deploy Command** | `npm run deploy:vercel` | `npm run deploy:cloudflare` |
| **Free Tier** | 100k invocations/month | 100k requests/day (3M/month) |
| **Cold Start** | ~50-200ms | ~1-10ms |
| **Background Tasks** | Not guaranteed | Guaranteed with `waitUntil()` |

## Environment Variables (Same for Both)

```bash
# Required
TORAN_API_URL=https://your-www-api.com

# Optional (for caching)
REDIS_URL=https://your-redis.upstash.io
REDIS_TOKEN=your-token

# Optional
ENVIRONMENT=production
```

**Setting Variables:**

**Vercel:**
```bash
# Via .env or Vercel Dashboard
```

**Cloudflare:**
```bash
wrangler secret put TORAN_API_URL
wrangler secret put REDIS_URL
wrangler secret put REDIS_TOKEN
```

## Migration Guide

### Existing Vercel Users
No changes needed! Your existing deployment continues to work.

### Want to Add Cloudflare?
1. Install dependencies: `npm install` (already updated)
2. Set secrets: `wrangler secret put TORAN_API_URL`
3. Deploy: `npm run deploy:cloudflare`

### Want to Switch from Vercel to Cloudflare?
1. Set Cloudflare secrets
2. Deploy to Cloudflare
3. Update DNS to point to your Cloudflare Worker
4. (Optional) Remove Vercel deployment

## Files by Platform

### Platform-Agnostic (Shared)
- `src/index.ts` - Core handler
- `src/core/*` - All core logic
- `src/mutations/*` - Mutation engine
- `src/cache/*` - Cache management
- `src/logging/*` - Logging
- `shared/*` - Type definitions

### Vercel-Specific
- `api/proxy.ts` - Entry point
- `vercel.json` - Configuration

### Cloudflare-Specific
- `src/worker.ts` - Entry point
- `wrangler.toml` - Configuration

### Platform Abstraction
- `src/platform/adapter.ts` - Platform detection
- `src/platform/types.ts` - Platform types

## Testing Both Platforms

### Test Vercel Locally
```bash
npm run dev:vercel
curl http://localhost:3000?subdomain=test
```

### Test Cloudflare Locally
```bash
npm run dev:cloudflare
curl http://localhost:8787?subdomain=test
```

## Choosing a Platform

**Choose Vercel if:**
- ✅ Already using Vercel
- ✅ Want GitHub integration for auto-deploys
- ✅ Need preview deployments for PRs
- ✅ Prefer simple CLI deployment

**Choose Cloudflare if:**
- ✅ Need best performance (faster cold starts)
- ✅ Have high-volume traffic (better free tier)
- ✅ Want guaranteed background task completion
- ✅ Already using Cloudflare for DNS/CDN

**Use Both if:**
- ✅ Want redundancy
- ✅ Need geographic failover
- ✅ Want to A/B test platforms

## Documentation

- **[PLATFORMS.md](./PLATFORMS.md)** - Detailed platform comparison and deployment guide
- **[README.md](./README.md)** - Updated with multi-platform instructions
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment guide (primarily Vercel)
- **[wrangler.toml](./wrangler.toml)** - Cloudflare Workers configuration

## Support

Both platforms use the same:
- toran API for configuration
- Redis for caching (optional)
- Environment variables
- Core logic and features

Choose the platform that best fits your infrastructure and requirements!
