import "server-only";
import { createClient, type Client, type InArgs } from "@libsql/client";
import { SCHEMA_SQL, HOME_TABLES_SQL, runMigrations } from "./schema";
import * as neonDb from "./db-neon";
import { PG_MIGRATIONS } from "./schema-pg";

let _client: Client | null = null;
let _ready: Promise<void> | null = null;

function client(): Client {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL ?? "file:atomic-habits.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

// run schema + migrations once per process
async function ready(): Promise<void> {
  if (!_ready) {
    _ready = (async () => {
      await client().executeMultiple(SCHEMA_SQL + HOME_TABLES_SQL);
      await runMigrations(client());
    })();
  }
  return _ready;
}

// Neon: base schema is applied by hand; additive columns run once per process.
let _pgReady: Promise<void> | null = null;
function pgReady(): Promise<void> {
  if (!_pgReady) {
    _pgReady = neonDb.dbBatch(PG_MIGRATIONS.map((sql) => ({ sql, args: [] }))).catch((e) => {
      _pgReady = null; // retry on the next query instead of caching the failure
      throw e;
    });
  }
  return _pgReady;
}

export async function dbGet<T>(sql: string, args: InArgs = []): Promise<T | undefined> {
  if (process.env.DATABASE_URL) return pgReady().then(() => neonDb.dbGet<T>(sql, args));
  await ready();
  const r = await client().execute({ sql, args });
  return r.rows[0] as T | undefined;
}
export async function dbAll<T>(sql: string, args: InArgs = []): Promise<T[]> {
  if (process.env.DATABASE_URL) return pgReady().then(() => neonDb.dbAll<T>(sql, args));
  await ready();
  const r = await client().execute({ sql, args });
  return r.rows as unknown as T[];
}
export async function dbRun(sql: string, args: InArgs = []): Promise<{ lastInsertRowid: number; rowsAffected: number }> {
  if (process.env.DATABASE_URL) return pgReady().then(() => neonDb.dbRun(sql, args));
  await ready();
  const r = await client().execute({ sql, args });
  return { lastInsertRowid: Number(r.lastInsertRowid ?? 0), rowsAffected: r.rowsAffected };
}

export async function dbBatch(statements: { sql: string; args: InArgs }[]): Promise<void> {
  if (process.env.DATABASE_URL) return pgReady().then(() => neonDb.dbBatch(statements));
  await ready();
  await client().batch(statements);
}
