# Deployment Guide

This guide covers deploying the Toran Proxy to Vercel Edge Runtime.

## Prerequisites

1. A Vercel account (free tier works)
2. A deployed toran-www instance with required API endpoints
3. (Optional) An Upstash Redis database for response caching

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `WWW_API_URL` | URL of your toran-www deployment | `https://toran-www.vercel.app` |

### Optional

| Variable | Description | Example |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection URL | `https://xxx.upstash.io` or `redis://user:pass@host:port` |
| `REDIS_TOKEN` | Redis token (for Upstash REST) | `AXXXxxx...` |
| `ENVIRONMENT` | Environment name | `production` |

## Deployment Methods

### Method 1: Vercel CLI (Recommended for testing)

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Method 2: GitHub Integration (Recommended for production)

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Configure Toran Proxy for Vercel"
   git push
   ```

2. **Connect to Vercel:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Configure project settings:
     - **Framework Preset:** Other
     - **Build Command:** `npm run build`
     - **Output Directory:** (leave empty)

3. **Add Environment Variables:**
   - In project settings, go to "Environment Variables"
   - Add the required variables:
     - `WWW_API_URL` (Production, Preview, Development)
     - `REDIS_URL` (optional)
     - `REDIS_TOKEN` (optional - for Upstash)

4. **Deploy:**
   - Click "Deploy"
   - Vercel will automatically deploy on every push to your main branch

### Method 3: Vercel Dashboard (Manual upload)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Select "Import Project" → "Import from Git"
4. Or drag and drop your project folder

## Post-Deployment

### 1. Configure Custom Domain

In Vercel project settings:
1. Go to "Domains"
2. Add your domain (e.g., `*.toran.dev`)
3. Configure DNS:
   - Add A record pointing to Vercel's IP: `76.76.21.21`
   - Or CNAME record to `cname.vercel-dns.com`

### 2. Verify Deployment

Test your deployment:

```bash
# Test gateway config loading
curl https://your-proxy.vercel.app?subdomain=test

# Test with actual subdomain (if DNS is configured)
curl https://test.your-domain.com/users/123
```

### 3. Monitor Logs

View real-time logs:
```bash
vercel logs your-project-name --follow
```

Or view in the Vercel Dashboard under "Deployments" → Click deployment → "Logs"

## Configuration Tips

### 1. Regions

By default, deployments go to `iad1` (Washington DC). To deploy to multiple regions:

```json
// vercel.json
{
  "regions": ["iad1", "sfo1", "lhr1"]
}
```

Available regions:
- `iad1` - Washington, D.C., USA
- `sfo1` - San Francisco, CA, USA
- `lhr1` - London, United Kingdom
- See [Vercel regions docs](https://vercel.com/docs/edge-network/regions) for full list

### 2. Function Timeout

Edge Functions have a max execution time of 30 seconds. If you need longer:

```json
// vercel.json
{
  "functions": {
    "api/proxy.ts": {
      "maxDuration": 30
    }
  }
}
```

### 3. Environment-Specific Variables

Use Vercel's environment scopes:

- **Production:** Only available in production deployments
- **Preview:** Only in preview deployments (PR previews)
- **Development:** Only in local development

Example:
```bash
# Production WWW API
WWW_API_URL=https://toran-www-production.vercel.app

# Preview WWW API
WWW_API_URL=https://toran-www-preview.vercel.app
```

## Troubleshooting

### Error: "WWW API URL not configured"

**Cause:** `WWW_API_URL` environment variable is not set.

**Solution:**
1. Check environment variables in Vercel Dashboard
2. Ensure the variable is set for the correct environment (Production/Preview)
3. Redeploy after adding the variable

### Error: "Gateway not found"

**Cause:** WWW API returned 404 or is not accessible.

**Solution:**
1. Verify `WWW_API_URL` is correct
2. Test the endpoint: `curl https://your-www-api.com/api/gateways/test`
3. Check WWW API logs for errors
4. Ensure the subdomain exists in your database

### Response caching not working

**Cause:** Redis is not configured or URL is incorrect.

**Solution:**
1. Verify `REDIS_URL` and `REDIS_TOKEN` (if using Upstash) are set
2. Check the URL format is correct (https:// for Upstash or redis:// for standard)
3. Test Redis connection from Vercel logs
4. Check Redis provider dashboard for connection errors
5. If Redis is optional for you, this is not an error - caching will be disabled

### High latency on first request

**Cause:** Cold start + API call to fetch gateway config.

**Solution:**
- This is expected behavior (50-200ms first request)
- Subsequent requests use in-memory cache (< 1ms)
- Consider using Vercel's "Edge Config" for even faster config loading
- Warm up instances with scheduled pings

## Production Checklist

- [ ] Environment variables configured (`WWW_API_URL` required)
- [ ] Custom domain configured and DNS propagated
- [ ] WWW API endpoints tested and working
- [ ] Redis configured (optional - only if using response caching)
- [ ] Logs monitored for errors
- [ ] Rate limiting configured (if needed)
- [ ] Analytics/monitoring set up
- [ ] Backup/rollback strategy in place
- [ ] Documentation updated with deployment URL

## Cost Optimization

### Vercel Costs

**Free Tier:**
- 100GB bandwidth/month
- 100k Edge Function invocations/month
- Unlimited deployments

**Pro Tier ($20/month):**
- 1TB bandwidth
- Unlimited Edge Function invocations
- Priority support

### Upstash Costs (Optional)

**Free Tier:**
- 10,000 commands/day
- 256MB storage

**Pay-as-you-go:**
- $0.2 per 100k commands
- $0.25 per GB storage

### Tips:
- Monitor bandwidth in Vercel Dashboard
- Use Redis only for high-traffic routes
- Set appropriate cache TTLs to reduce API calls
- Consider Vercel's Edge Config for frequently accessed data

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support)
- [Upstash Documentation](https://docs.upstash.com/)
