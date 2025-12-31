/**
 * Platform abstraction types
 * Provides a unified interface for Vercel and Cloudflare Workers
 */

export type Platform = 'vercel' | 'cloudflare';

/**
 * Platform context - abstracts platform-specific features
 */
export interface PlatformContext {
  /**
   * Platform name
   */
  platform: Platform;

  /**
   * Schedule a background task
   * - Cloudflare: Uses ctx.waitUntil()
   * - Vercel: Uses Promise.resolve().then()
   */
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Platform-specific environment
 * Extends base Env with platform-specific bindings
 */
export interface PlatformEnv {
  // Common
  WWW_API_URL: string;
  REDIS_URL?: string;
  ENVIRONMENT?: string;

  // Platform-specific (Cloudflare)
  // These will be undefined on Vercel
  CACHE_KV?: KVNamespace;
  CONFIG_KV?: KVNamespace;
}
