import "server-only";
import Database from "better-sqlite3";
import path from "node:path";
import { SCHEMA_SQL, runMigrations } from "./schema";

const DB_PATH = path.join(process.cwd(), "atomic-habits.db");

// Module-level singleton survives Next.js dev hot-reloads.
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    _db.exec(SCHEMA_SQL);
    runMigrations(_db);
  }
  return _db;
}
