import { MongoClient, Db } from "mongodb";

let cachedDb: Db | null = null;

export const getDb = async (): Promise<Db> => {
  if (cachedDb) return cachedDb;
  const uri = process.env.MONGO_URI;
  const dbName = process.env.DB_NAME;
  if (!uri) throw new Error("MONGO_URI is not set");
  if (!dbName) throw new Error("DB_NAME is not set");

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 3 });
  await client.connect();
  cachedDb = client.db(dbName);
  return cachedDb!;
};

