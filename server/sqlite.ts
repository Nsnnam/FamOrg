/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { FamilyOrganizerDB } from "../src/types.js";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "family.db");
const SCHEMA_VERSION = 1;

// Map each FamilyOrganizerDB collection key -> SQLite table name.
// Each row keeps the full record as JSON plus a `seq` column so array order
// (newest-first lists, etc.) is preserved exactly across save/load.
const COLLECTIONS: { key: keyof FamilyOrganizerDB; table: string }[] = [
  { key: "users", table: "users" },
  { key: "tasks", table: "tasks" },
  { key: "plans", table: "plans" },
  { key: "notes", table: "notes" },
  { key: "transactions", table: "transactions" },
  { key: "rewardLedger", table: "reward_ledger" },
  { key: "budgets", table: "budgets" },
  { key: "recurringBills", table: "recurring_bills" },
  { key: "assets", table: "assets" },
  { key: "medications", table: "medications" },
  { key: "shoppingItems", table: "shopping_items" },
  { key: "dishLibrary", table: "dish_library" },
  { key: "notifications", table: "notifications" },
  { key: "pushSubscriptions", table: "push_subscriptions" },
  { key: "activityLogs", table: "activity_logs" },
  { key: "backups", table: "backup_records" }
];

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

// Schema: a document-style table per collection (id, seq, data JSON) + app_meta.
db.exec(`
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);
for (const { table } of COLLECTIONS) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id   TEXT PRIMARY KEY,
      seq  INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_${table}_seq ON ${table}(seq);
  `);
}
const getMetaStmt = db.prepare("SELECT value FROM app_meta WHERE key = ?");
const setMetaStmt = db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)");
setMetaStmt.run("schema_version", String(SCHEMA_VERSION));

// Singleton (non-array) fields stored as a single JSON row in app_meta.
const SINGLETON_KEYS: (keyof FamilyOrganizerDB)[] = ["mealPlan"];

/** True when the database has never been seeded (no user accounts yet). */
export function sqliteIsEmpty(): boolean {
  const row = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  return row.c === 0;
}

/** Reconstruct the full in-memory DB object from SQLite, preserving order. */
export function sqliteLoad(): FamilyOrganizerDB {
  const out: any = {};
  for (const { key, table } of COLLECTIONS) {
    const rows = db.prepare(`SELECT data FROM ${table} ORDER BY seq ASC`).all() as { data: string }[];
    out[key] = rows.map(r => JSON.parse(r.data));
  }
  for (const key of SINGLETON_KEYS) {
    const row = getMetaStmt.get(`singleton:${key}`) as { value: string } | undefined;
    out[key] = row && row.value ? JSON.parse(row.value) : null;
  }
  return out as FamilyOrganizerDB;
}

// Prepared per-collection replace statements.
const deleteStmts = new Map<string, Database.Statement>();
const insertStmts = new Map<string, Database.Statement>();
for (const { table } of COLLECTIONS) {
  deleteStmts.set(table, db.prepare(`DELETE FROM ${table}`));
  insertStmts.set(table, db.prepare(`INSERT INTO ${table} (id, seq, data) VALUES (?, ?, ?)`));
}

/** Persist the full in-memory DB object atomically (single WAL transaction). */
export const sqliteSave = db.transaction((data: FamilyOrganizerDB) => {
  for (const { key, table } of COLLECTIONS) {
    deleteStmts.get(table)!.run();
    const insert = insertStmts.get(table)!;
    const arr: any[] = (data as any)[key] || [];
    arr.forEach((item, i) => {
      const id = item && item.id != null ? String(item.id) : `row_${i}`;
      insert.run(id, i, JSON.stringify(item));
    });
  }
  for (const key of SINGLETON_KEYS) {
    setMetaStmt.run(`singleton:${key}`, JSON.stringify((data as any)[key] ?? null));
  }
}) as unknown as (data: FamilyOrganizerDB) => void;

export function sqliteCheckpoint(): void {
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch (e) {
    console.error("Lỗi checkpoint WAL:", e);
  }
}
