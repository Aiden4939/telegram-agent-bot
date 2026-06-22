import { getDb } from "./database.js";

export function ensureSchema(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      title TEXT,
      summary TEXT NOT NULL,
      raw_text TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notes_chat_id ON notes(chat_id);

    CREATE TABLE IF NOT EXISTS telegram_sessions (
      chat_id TEXT PRIMARY KEY,
      agent_id TEXT,
      cwd TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
