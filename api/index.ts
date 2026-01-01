import { handleRequest } from '../src/index';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request): Promise<Response> {
  return handleRequest(request);
}
