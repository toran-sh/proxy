import { handleRequest } from '../src/index.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request): Promise<Response> {
  return handleRequest(request);
}
