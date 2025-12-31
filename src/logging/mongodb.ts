import { MongoClient, type Db } from 'mongodb';
import type { RequestLog } from '../types/index.js';

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

async function getMongoDb(): Promise<Db | null> {
  if (mongoDb) {
    return mongoDb;
  }

  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DATABASE || 'toran_proxy';

  if (!uri) {
    console.warn('MONGODB_URI not set, logging disabled');
    return null;
  }

  try {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    mongoDb = mongoClient.db(dbName);
    return mongoDb;
  } catch (e) {
    console.error('Failed to connect to MongoDB:', e);
    return null;
  }
}

export async function logRequest(log: RequestLog): Promise<void> {
  try {
    const db = await getMongoDb();
    if (!db) return;

    await db.collection('request_logs').insertOne(log);
  } catch (e) {
    console.error('Failed to log request:', e);
  }
}

export async function closeMongoConnection(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
  }
}
