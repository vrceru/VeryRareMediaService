import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  stage TEXT NOT NULL DEFAULT 'received',
  media_type TEXT,
  title TEXT NOT NULL,
  request_payload TEXT NOT NULL,
  selected_release TEXT,
  release_candidates TEXT,
  metadata TEXT,
  primary_media_file TEXT,
  media_files TEXT,
  download_provider_id TEXT,
  download_ref TEXT,
  progress REAL NOT NULL DEFAULT 0,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_attempt_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

CREATE TABLE IF NOT EXISTS job_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_history_job_id ON job_history(job_id);
`;

// Additive migrations for columns added after the jobs table's first release, since
// "CREATE TABLE IF NOT EXISTS" above is a no-op against an already-existing table.
const MIGRATIONS: { table: string; column: string; type: string }[] = [{ table: "jobs", column: "media_files", type: "TEXT" }];

function runMigrations(db: DatabaseSync): void {
  for (const { table, column, type } of MIGRATIONS) {
    const existing = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
    if (!existing.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }
}

export type Db = DatabaseSync;

export function createDb(databasePath: string): Db {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(BOOTSTRAP_SQL);
  runMigrations(db);
  return db;
}
