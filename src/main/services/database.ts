import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { Database, SqlJsStatic } from 'sql.js';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js') as typeof import('sql.js').default;

let sqlModulePromise: Promise<SqlJsStatic> | null = null;
let dbPromise: Promise<Database> | null = null;

function loadSqlModule(): Promise<SqlJsStatic> {
  if (!sqlModulePromise) {
    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
    sqlModulePromise = initSqlJs({
      locateFile: () => wasmPath
    });
  }
  return sqlModulePromise;
}

export async function getDatabase(): Promise<Database> {
  dbPromise ??= openDatabase();
  return dbPromise;
}

async function openDatabase(): Promise<Database> {
  const SQL = await loadSqlModule();
  const dataDir = await ensureDatabaseDir();
  const dbPath = path.join(dataDir, 'screensaver.sqlite');

  let db: Database;
  try {
    const existing = await readFile(dbPath);
    db = new SQL.Database(existing);
  } catch {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      captured_at TEXT NOT NULL,
      app_name TEXT,
      window_title TEXT,
      phase TEXT,
      source TEXT,
      screenshot_path TEXT,
      selected_region_path TEXT,
      redaction_count INTEGER DEFAULT 0,
      total_ms INTEGER,
      result_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app TEXT NOT NULL,
      phase TEXT NOT NULL,
      app_signals TEXT NOT NULL,
      text_signals TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(app, phase, source)
    );
  `);

  await persistDatabase(db);
  return db;
}

export async function persistDatabase(db?: Database): Promise<void> {
  const database = db ?? (await getDatabase());
  const dataDir = await ensureDatabaseDir();
  const dbPath = path.join(dataDir, 'screensaver.sqlite');
  await writeFile(dbPath, Buffer.from(database.export()));
}

async function ensureDatabaseDir(): Promise<string> {
  const dir = path.join(app.getPath('userData'), 'screensaver-data');
  await mkdir(dir, { recursive: true });
  return dir;
}
