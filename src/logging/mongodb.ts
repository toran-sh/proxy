import type { Runtime, RequestLog, Env } from '../types/index.js';

let mongoClient: unknown = null;
let mongoDb: unknown = null;

interface MongoCollection {
  insertOne(doc: unknown): Promise<unknown>;
}

interface MongoDatabase {
  collection(name: string): MongoCollection;
}

async function getMongoClient(runtime: Runtime): Promise<MongoDatabase | null> {
  if (runtime === 'cloudflare') {
    // Cloudflare Workers - use MongoDB Atlas Data API
    return null;
  }

  if (mongoDb) {
    return mongoDb as MongoDatabase;
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'toran_proxy';

  if (!uri) {
    console.warn('MONGODB_URI not set, logging disabled');
    return null;
  }

  try {
    const { MongoClient } = await import('mongodb');
    mongoClient = new MongoClient(uri);
    await (mongoClient as { connect(): Promise<void> }).connect();
    mongoDb = (mongoClient as { db(name: string): MongoDatabase }).db(dbName);
    return mongoDb as MongoDatabase;
  } catch (e) {
    console.error('Failed to connect to MongoDB:', e);
    return null;
  }
}

async function logViaDataApi(log: RequestLog, env: Env): Promise<void> {
  const apiUrl = env.MONGODB_DATA_API_URL;
  const apiKey = env.MONGODB_DATA_API_KEY;
  const database = env.MONGODB_DATABASE || 'toran_proxy';

  if (!apiUrl || !apiKey) {
    console.warn('MongoDB Data API credentials not set, logging disabled');
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

export async function logRequest(
  runtime: Runtime,
  log: RequestLog,
  env?: Env
): Promise<void> {
  try {
    if (runtime === 'cloudflare') {
      if (env) {
        await logViaDataApi(log, env);
      }
      return;
    }

    const db = await getMongoClient(runtime);
    if (!db) {
      return;
    }

    await db.collection('request_logs').insertOne(log);
  } catch (e) {
    console.error('Failed to log request:', e);
  }
}

export async function closeMongoConnection(): Promise<void> {
  if (mongoClient) {
    await (mongoClient as { close(): Promise<void> }).close();
    mongoClient = null;
    mongoDb = null;
  }
}
