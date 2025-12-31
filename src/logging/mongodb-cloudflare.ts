import type { RequestLog, Env } from '../types/index.js';

export async function logRequest(log: RequestLog, env: Env): Promise<void> {
  const apiUrl = env.MONGODB_DATA_API_URL;
  const apiKey = env.MONGODB_DATA_API_KEY;
  const database = env.MONGODB_DATABASE || 'toran_proxy';

  if (!apiUrl || !apiKey) {
    return;
  }

  try {
    await fetch(`${apiUrl}/action/insertOne`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        dataSource: 'Cluster0',
        database,
        collection: 'request_logs',
        document: {
          ...log,
          timestamp: { $date: log.timestamp.toISOString() },
        },
      }),
    });
  } catch (e) {
    console.error('Failed to log via Data API:', e);
  }
}
