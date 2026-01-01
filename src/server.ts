import { createServer } from 'http';
import { handleRequest } from './index.js';

const port = parseInt(process.env.PORT || '3000', 10);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // Convert Node.js request to Web Request
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
    }

    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await new Promise<string>((resolve) => {
        let data = '';
        req.on('data', (chunk) => (data += chunk));
        req.on('end', () => resolve(data));
      });
    }

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body: body || undefined,
    });

    const response = await handleRequest(request);

    // Send response
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const responseBody = await response.text();
    res.end(responseBody);
  } catch (e) {
    console.error('Server error:', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(port, () => {
  console.log(`Toran Proxy running on http://localhost:${port}`);
  console.log('Use ?_sub_domain_=<name> to specify upstream in localhost mode');
});
