import assert from "node:assert";
import { __setNeonFactoryForTest, dbGet, dbRun, translateSql } from "./db-neon";

async function main(): Promise<void> {
assert.equal(
  translateSql("SELECT '?' AS literal, ? AS value, \"?\" AS identifier"),
  "SELECT '?' AS literal, $1 AS value, \"?\" AS identifier",
  "only placeholders outside quoted strings are translated",
);
assert.equal(
  translateSql("INSERT OR IGNORE INTO habits (name) VALUES (?)"),
  "INSERT INTO habits (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id",
  "OR IGNORE becomes ON CONFLICT DO NOTHING and identity inserts return their id",
);
assert.equal(
  translateSql("UPDATE home_tasks SET done_at = datetime('now') WHERE id = ?"),
  "UPDATE home_tasks SET done_at = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS') WHERE id = $1",
  "SQLite timestamps use PostgreSQL UTC formatting",
);
assert.equal(
  translateSql("INSERT INTO completions (habit_id, user_id, date) VALUES (?, ?, ?)"),
  "INSERT INTO completions (habit_id, user_id, date) VALUES ($1, $2, $3)",
  "tables without identity ids do not get RETURNING",
);
assert.equal(
  translateSql("INSERT INTO users (email) VALUES (?) RETURNING id"),
  "INSERT INTO users (email) VALUES ($1) RETURNING id",
  "an existing RETURNING clause is not duplicated",
);

process.env.DATABASE_URL = "postgres://test";

let recordedSql = "";
__setNeonFactoryForTest(
  (() => ({
    query: async (sql: string) => {
      recordedSql = sql;
      return {
        fields: [{ name: "id", dataTypeID: 23 }, { name: "total", dataTypeID: 1700 }],
        command: "SELECT",
        rowCount: 1,
        rows: [{ id: 7, total: "12.5" }],
        rowAsArray: false,
      };
    },
  })) as never,
);
const numeric = await dbGet<{ id: number; total: number }>("SELECT 7 AS id, 12.5 AS total");
assert.deepEqual(numeric, { id: 7, total: 12.5 }, "numeric result fields are returned as numbers");

__setNeonFactoryForTest(
  (() => ({
    query: async (sql: string) => {
      recordedSql = sql;
      return { fields: [], command: "INSERT", rowCount: 0, rows: [], rowAsArray: false };
    },
  })) as never,
);
assert.deepEqual(
  await dbRun("INSERT OR IGNORE INTO connections (requester_id, addressee_id) VALUES (?, ?)", [1, 2]),
  { lastInsertRowid: 0, rowsAffected: 0 },
  "ignored INSERT OR IGNORE reports no id and no affected rows",
);
assert.match(recordedSql, /ON CONFLICT DO NOTHING RETURNING id$/, "ignored inserts still use the translated SQL");

const expected = new Error("driver failed");
__setNeonFactoryForTest(
  (() => ({
    query: async () => {
      throw expected;
    },
  })) as never,
);
await assert.rejects(dbRun("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)", ["a@x.no", "A", "h"]), expected);

console.log("✓ all db-neon checks passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
