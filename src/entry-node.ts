import { serve } from '@hono/node-server';
import { createApp } from './index.js';

const app = createApp();

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting Toran Proxy on http://localhost:${port}`);
console.log('Use ?_sub_domain_=<name> to specify upstream in localhost mode');

serve({
  fetch: app.fetch,
  port,
});
