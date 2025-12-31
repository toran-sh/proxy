/**
 * Cloudflare Workers Entry Point
 *
 * This file is used when deploying to Cloudflare Workers.
 * For Vercel deployment, use api/proxy.ts instead.
 */

import type { PlatformEnv } from './platform/types';
import { createCloudflareContext } from './platform/adapter';
import { handleRequest } from './index';
import type { Env } from '../shared/src/types';

export default {
  async fetch(
    request: Request,
    env: PlatformEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Create Cloudflare platform context
    const platformContext = createCloudflareContext(ctx);

    // Convert PlatformEnv to Env
    const workerEnv: Env = {
      WWW_API_URL: env.WWW_API_URL,
      REDIS_URL: env.REDIS_URL,
      ENVIRONMENT: env.ENVIRONMENT,
    };

    // Handle request with platform context
    return handleRequest(request, workerEnv, platformContext);
  },
};
