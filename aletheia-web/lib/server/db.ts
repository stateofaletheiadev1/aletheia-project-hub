import 'server-only';
import { AletheiaDB, type Collection } from '@aletheia/aletheiadb';
import schema from './schema.json';

// The only module that opens AletheiaDB. Everything else asks for a collection here.
// ALETHEIADB_URL is a readWrite (or admin) key for the web platform's database, e.g.
//   aletheiadb://<keyId>:<secret>@db.stateofaletheia.org/web
// Collections and indexes are created by `npm run db:bootstrap` (scripts/db/bootstrap.mjs).
// Personal data is encrypted before it gets here (envelope.ts).

export type CollectionName = keyof typeof schema;

let client: AletheiaDB | null | undefined;

function connect(): AletheiaDB | null {
  if (client !== undefined) return client;
  const url = process.env.ALETHEIADB_URL;
  client = url ? AletheiaDB.connect(url, { retries: 1 }) : null;
  return client;
}

/** The portal and console need both the database and the personal-data master key. */
export function databaseConfigured(): boolean {
  return Boolean(process.env.ALETHEIADB_URL && process.env.DATA_ENCRYPTION_MASTER_KEY);
}

export class NotConfiguredError extends Error {
  constructor() {
    super('ALETHEIADB_URL is not set: the portal and administration are disabled');
  }
}

export function collection<T extends object>(name: CollectionName): Collection<T> {
  const db = connect();
  if (!db) throw new NotConfiguredError();
  return db.db().collection<T>(name);
}
