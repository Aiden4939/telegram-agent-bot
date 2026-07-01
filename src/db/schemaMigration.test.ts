import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tg-migrate-test-"));
const dbPath = path.join(tmpDir, "migration.db");

process.env.TELEGRAM_BOT_TOKEN ||= "test-token";
process.env.ALLOWED_TELEGRAM_USER_IDS ||= "1";
process.env.OPENAI_API_KEY ||= "test-key";
process.env.INTERNAL_API_SECRET ||= "test-secret";
process.env.SESSION_DB_PATH = dbPath;

test.after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function freshReset(): Promise<void> {
  const { closeDb, getDb } = await import("./database.js");
  closeDb();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  const db = getDb();
  db.exec(`
    CREATE TABLE telegram_updates (
      update_id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      message_id TEXT,
      received_at TEXT NOT NULL,
      processed_at TEXT,
      status TEXT NOT NULL,
      error_code TEXT
    );
    CREATE TABLE tasks (
      task_id TEXT PRIMARY KEY,
      task_type TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      status TEXT NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'not_required',
      original_request TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  closeDb();
}

test("migration supports existing stage-b-like schema and rerun", async () => {
  await freshReset();
  const { ensureSchema } = await import("./schema.js");
  const { getDb } = await import("./database.js");
  ensureSchema();
  ensureSchema();

  const db = getDb();
  const columns = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;
  assert.equal(columns.some((c) => c.name === "ci_run_url"), true);
  assert.equal(columns.some((c) => c.name === "retry_count"), true);

  db.prepare(
    `INSERT INTO tasks (task_id, task_type, requested_by, chat_id, status, original_request)
     VALUES ('t1', 'dev', '1', '1', 'RECEIVED', 'x')`
  ).run();
  db.prepare(
    `INSERT INTO task_ci_runs (task_id, repository, workflow_run_id, status)
     VALUES ('t1', 'Aiden4939/telegram-agent-bot', '100', 'queued')`
  ).run();
  assert.throws(() => {
    db.prepare(
      `INSERT INTO task_ci_runs (task_id, repository, workflow_run_id, status)
       VALUES ('t1', 'Aiden4939/telegram-agent-bot', '100', 'queued')`
    ).run();
  });
});
