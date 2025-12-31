/**
 * Platform Adapter - Creates platform-specific context
 */

import type { PlatformContext, Platform } from './types';

/**
 * Create Vercel platform context
 */
export function createVercelContext(): PlatformContext {
  return {
    platform: 'vercel',
    waitUntil(promise: Promise<unknown>): void {
      // Vercel Edge Runtime: Use Promise to run async tasks
      // These run in the background but have no guarantee of completion
      Promise.resolve().then(() => promise).catch(err => {
        console.error('Background task error:', err);
      });
    },
  };
}

/**
 * Create Cloudflare Workers context
 */
export function createCloudflareContext(ctx: ExecutionContext): PlatformContext {
  return {
    platform: 'cloudflare',
    waitUntil(promise: Promise<unknown>): void {
      // Cloudflare Workers: Use ctx.waitUntil() for background tasks
      ctx.waitUntil(promise);
    },
  };
}

/**
 * Auto-detect platform and create appropriate context
 */
export function detectPlatform(): Platform {
  // Check for Vercel-specific environment variables
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    return 'vercel';
  }

  // Check for Cloudflare-specific globals
  if (typeof caches !== 'undefined' && typeof ExecutionContext !== 'undefined') {
    return 'cloudflare';
  }

  // Default to Vercel
  return 'vercel';
}
