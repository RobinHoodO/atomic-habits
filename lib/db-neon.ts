import { neon, type FullQueryResults, type NeonQueryFunction } from "@neondatabase/serverless";
import type { InArgs } from "@libsql/client";

type FullResult = FullQueryResults<false>;
type NeonClient = NeonQueryFunction<false, false>;
type Statement = { sql: string; args: InArgs };

const ID_TABLES = new Set([
  "users",
  "identities",
  "habits",
  "connections",
  "habit_stacks",
  "temptation_bundles",
  "environment_items",
  "challenges",
  "homes",
  "chores",
  "chore_logs",
  "home_tasks",
  "home_rewards",
  "home_redemptions",
  "home_events",
]);

let neonFactory = neon;
let client: NeonClient | null = null;

function getClient(): NeonClient {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required for the Neon backend");
    client = neonFactory(connectionString);
  }
  return client;
}

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_]/.test(char);
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_]/.test(char);
}

function insertTable(sql: string): string | undefined {
  const match = /^\s*INSERT(?:\s+OR\s+IGNORE)?\s+INTO\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/i.exec(sql);
  return match?.[1] ?? match?.[2]?.toLowerCase();
}

function needsReturningId(sql: string): boolean {
  const table = insertTable(sql);
  return !!table && ID_TABLES.has(table.toLowerCase()) && !/\bRETURNING\b/i.test(sql);
}

function appendReturningId(sql: string): string {
  const semicolon = /;\s*$/.test(sql);
  const body = semicolon ? sql.replace(/;\s*$/, "") : sql;
  return `${body} RETURNING id${semicolon ? ";" : ""}`;
}

function appendConflictDoNothing(sql: string): string {
  const semicolon = /;\s*$/.test(sql);
  const body = semicolon ? sql.replace(/;\s*$/, "") : sql;
  return `${body} ON CONFLICT DO NOTHING${semicolon ? ";" : ""}`;
}

type TranslatedStatement = { sql: string; args: unknown[] };

function translateStatement(sql: string, args: InArgs): TranslatedStatement {
  const positional = Array.isArray(args) ? args : null;
  const named: Record<string, unknown> | null = positional ? null : args as Record<string, unknown>;
  const values: unknown[] = [];
  let placeholder = 0;
  let out = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      out += char;
      if (char === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      out += char;
      if (char === "*" && next === "/") {
        out += next;
        i += 1;
        inBlockComment = false;
      }
      continue;
    }
    if (inSingleQuote) {
      out += char;
      if (char === "'" && next === "'") {
        out += next;
        i += 1;
      } else if (char === "'") {
        inSingleQuote = false;
      }
      continue;
    }
    if (inDoubleQuote) {
      out += char;
      if (char === '"' && next === '"') {
        out += next;
        i += 1;
      } else if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }
    if (char === "-" && next === "-") {
      out += char + next;
      i += 1;
      inLineComment = true;
      continue;
    }
    if (char === "/" && next === "*") {
      out += char + next;
      i += 1;
      inBlockComment = true;
      continue;
    }
    if (char === "'") {
      out += char;
      inSingleQuote = true;
      continue;
    }
    if (char === '"') {
      out += char;
      inDoubleQuote = true;
      continue;
    }
    if (/^datetime\(\s*'now'\s*\)/i.test(sql.slice(i))) {
      out += "to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')";
      i += /^datetime\(\s*'now'\s*\)/i.exec(sql.slice(i))![0].length - 1;
      continue;
    }
    if (char === "?") {
      if (!positional) throw new Error("Positional placeholders require an array of arguments");
      values.push(positional[placeholder]);
      placeholder += 1;
      out += `$${values.length}`;
      continue;
    }
    if (char === "@" && isIdentifierStart(next ?? "")) {
      let end = i + 2;
      while (end < sql.length && isIdentifierPart(sql[end])) end += 1;
      const name = sql.slice(i + 1, end);
      if (!named) throw new Error("Named placeholders require an object of arguments");
      values.push(named[name]);
      out += `$${values.length}`;
      i = end - 1;
      continue;
    }
    out += char;
  }

  const ignored = /^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(out);
  if (ignored) out = out.replace(/^(\s*)INSERT\s+OR\s+IGNORE\s+INTO\b/i, "$1INSERT INTO");
  if (ignored) out = appendConflictDoNothing(out);
  if (needsReturningId(out)) out = appendReturningId(out);
  return { sql: out, args: values };
}

export function translateSql(sql: string): string {
  return translateStatement(sql, []).sql;
}

function normalizeRows(result: FullResult): Record<string, unknown>[] {
  const numericColumns = new Set(
    result.fields.filter((field) => field.dataTypeID === 20 || field.dataTypeID === 1700).map((field) => field.name),
  );
  return result.rows.map((row) => {
    const normalized = { ...row } as Record<string, unknown>;
    for (const column of numericColumns) {
      if (typeof normalized[column] === "string") normalized[column] = Number(normalized[column]);
    }
    return normalized;
  });
}

async function query(sql: string, args: InArgs): Promise<FullResult> {
  const statement = translateStatement(sql, args);
  return getClient().query(statement.sql, statement.args, { fullResults: true }) as Promise<FullResult>;
}

export async function dbGet<T>(sql: string, args: InArgs = []): Promise<T | undefined> {
  const result = await query(sql, args);
  return normalizeRows(result)[0] as T | undefined;
}

export async function dbAll<T>(sql: string, args: InArgs = []): Promise<T[]> {
  return normalizeRows(await query(sql, args)) as T[];
}

export async function dbRun(sql: string, args: InArgs = []): Promise<{ lastInsertRowid: number; rowsAffected: number }> {
  const result = await query(sql, args);
  const row = normalizeRows(result)[0];
  return { lastInsertRowid: Number(row?.id ?? 0), rowsAffected: result.rowCount };
}

export async function dbBatch(statements: Statement[]): Promise<void> {
  await getClient().transaction((tx) =>
    statements.map((statement) => {
      const translated = translateStatement(statement.sql, statement.args);
      return tx.query(translated.sql, translated.args);
    }),
  );
}

export function __setNeonFactoryForTest(factory: typeof neon): void {
  neonFactory = factory;
  client = null;
}
