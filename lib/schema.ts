// Multi-user, self-hosted schema. Idempotent CREATE IF NOT EXISTS.
// The DB is fresh (no production data yet), so no migration runner is needed —
// ponytail: add a versioned runner the first time the schema changes under a
// live DB with real users. A schema_version stamp is written so that's easy.

export const SCHEMA_VERSION = 2;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS identities (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  statement  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS habits (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL DEFAULT 'good',      -- good | bad | neutral
  identity_id        INTEGER REFERENCES identities(id) ON DELETE SET NULL,
  cue                TEXT,
  craving            TEXT,
  response           TEXT,
  reward             TEXT,
  intention_time     TEXT,
  intention_location TEXT,
  gateway_text       TEXT,
  schedule           TEXT NOT NULL DEFAULT 'daily',
  visibility         TEXT NOT NULL DEFAULT 'private',   -- private | connections
  archived           INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A habit's participants live here (owner is always a member; >1 member = paired).
CREATE TABLE IF NOT EXISTS habit_members (
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role     TEXT NOT NULL DEFAULT 'partner',            -- owner | partner
  PRIMARY KEY (habit_id, user_id)
);

CREATE TABLE IF NOT EXISTS completions (
  habit_id   INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,                            -- YYYY-MM-DD
  is_gateway INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (habit_id, user_id, date)
);

-- mutual connection / follow: accepted = each can track the other's visible habits
CREATE TABLE IF NOT EXISTS connections (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending',        -- pending | accepted
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS habit_stacks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  anchor_habit_id  INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  stacked_habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  UNIQUE (anchor_habit_id, stacked_habit_id)
);

CREATE TABLE IF NOT EXISTS temptation_bundles (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id  INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  want_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS environment_items (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  text     TEXT NOT NULL,
  kind     TEXT NOT NULL DEFAULT 'obvious'             -- obvious | friction
);

CREATE TABLE IF NOT EXISTS contracts (
  habit_id     INTEGER PRIMARY KEY REFERENCES habits(id) ON DELETE CASCADE,
  commitment   TEXT NOT NULL,
  stake        TEXT,
  consequence  TEXT,
  partner_name TEXT
);

-- gamification: unlocked achievements (badges)
CREATE TABLE IF NOT EXISTS achievements (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key       TEXT NOT NULL,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, key)
);

-- head-to-head challenges between two connected users
CREATE TABLE IF NOT EXISTS challenges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  a_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric      TEXT NOT NULL DEFAULT 'checkins',
  starts_on   TEXT NOT NULL,
  ends_on     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',   -- pending | active | done | declined
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- power-ups: a freeze protects a scheduled day from counting as a miss
CREATE TABLE IF NOT EXISTS streak_freezes (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date     TEXT NOT NULL,
  PRIMARY KEY (user_id, habit_id, date)
);
CREATE TABLE IF NOT EXISTS freeze_credits (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  earned  INTEGER NOT NULL DEFAULT 0
);
`;

// First real migration: the DB already holds data, so new COLUMNS need ALTER
// (CREATE IF NOT EXISTS above covers new TABLES). Each step is idempotent —
// a duplicate-column error just means it's already applied. ponytail: a guarded
// ALTER list beats a version-number ledger for a handful of additive changes.
export function runMigrations(db: import("better-sqlite3").Database): void {
  const steps = [
    "ALTER TABLE contracts ADD COLUMN partner_user_id INTEGER REFERENCES users(id)",
  ];
  for (const sql of steps) {
    try {
      db.exec(sql);
    } catch (e) {
      if (!String(e).includes("duplicate column")) throw e;
    }
  }
}
