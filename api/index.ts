import { handleRequest } from '../src/index';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: Request): Promise<Response> {
  return handleRequest(request);
}
