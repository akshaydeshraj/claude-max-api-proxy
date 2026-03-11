import Database from "better-sqlite3";
import { config } from "../config.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

let db: Database.Database | null = null;

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    model TEXT NOT NULL,
    stream INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    openai_model TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    user_email TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at)`,
];

export function getDb(): Database.Database {
  if (db) return db;

  // Ensure directory exists
  const dir = dirname(config.dbPath);
  mkdirSync(dir, { recursive: true });

  db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");

  // Run migrations
  for (const sql of MIGRATIONS) {
    db.exec(sql);
  }

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
