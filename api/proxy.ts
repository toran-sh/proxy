/**
 * Vercel Edge Function - Main Proxy Handler
 *
 * This is the entry point for all requests to the Vercel Edge Runtime.
 * For Cloudflare Workers deployment, use src/worker.ts instead.
 */

import { handleRequest } from '../src/index';
import { createVercelContext } from '../src/platform/adapter';
import type { Env } from '../shared/src/types';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request): Promise<Response> {
  // Build environment from process.env
  const env: Env = {
    TORAN_API_URL: process.env.TORAN_API_URL || '',
    REDIS_URL: process.env.REDIS_URL,
    ENVIRONMENT: process.env.ENVIRONMENT || 'production',
  };

  // Create Vercel platform context
  const platformContext = createVercelContext();

  return handleRequest(request, env, platformContext);
}
