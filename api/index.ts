import { handleRequest } from '../dist/index.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: Request): Promise<Response> {
  return handleRequest(request);
}
