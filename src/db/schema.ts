import { getDb } from "./database.js";

function hasColumn(table: string, column: string): boolean {
  const db = getDb();
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function ensureColumn(table: string, column: string, typeDef: string): void {
  const db = getDb();
  if (!hasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeDef}`);
  }
}

export function ensureSchema(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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

    CREATE TABLE IF NOT EXISTS telegram_updates (
      update_id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      message_id TEXT,
      received_at TEXT NOT NULL DEFAULT (datetime('now')),
      processed_at TEXT,
      status TEXT NOT NULL,
      error_code TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_telegram_updates_chat_id ON telegram_updates(chat_id);
    CREATE INDEX IF NOT EXISTS idx_telegram_updates_status ON telegram_updates(status);

    CREATE TABLE IF NOT EXISTS tasks (
      task_id TEXT PRIMARY KEY,
      task_type TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      source_update_id TEXT,
      source_message_id TEXT,
      repository TEXT,
      base_branch TEXT,
      working_branch TEXT,
      issue_number INTEGER,
      pull_request_number INTEGER,
      pull_request_url TEXT,
      agent_provider TEXT,
      agent_id TEXT,
      agent_run_id TEXT,
      request_id TEXT,
      status TEXT NOT NULL,
      risk_level TEXT NOT NULL DEFAULT 'normal',
      approval_status TEXT NOT NULL DEFAULT 'not_required',
      original_request TEXT NOT NULL,
      confirmed_constraints TEXT,
      progress_summary TEXT,
      completed_items_json TEXT NOT NULL DEFAULT '[]',
      remaining_items_json TEXT NOT NULL DEFAULT '[]',
      pending_question TEXT,
      last_commit_sha TEXT,
      ci_run_id TEXT,
      ci_run_url TEXT,
      ci_status TEXT,
      ci_conclusion TEXT,
      ci_head_sha TEXT,
      ci_started_at TEXT,
      ci_completed_at TEXT,
      ci_failed_job TEXT,
      ci_failed_step TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      test_result_json TEXT NOT NULL DEFAULT '{}',
      estimated_cost REAL NOT NULL DEFAULT 0,
      actual_cost REAL NOT NULL DEFAULT 0,
      model_call_count INTEGER NOT NULL DEFAULT 0,
      tool_call_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT,
      expires_at TEXT,
      last_heartbeat_at TEXT,
      error_code TEXT,
      error_summary TEXT,
      FOREIGN KEY(source_update_id) REFERENCES telegram_updates(update_id)
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_chat_status ON tasks(chat_id, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_status_updated_at ON tasks(status, updated_at);

    CREATE TABLE IF NOT EXISTS task_events (
      event_id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id, created_at);

    CREATE TABLE IF NOT EXISTS approval_tokens (
      token TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      action TEXT NOT NULL,
      telegram_user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_approval_tokens_task_id ON approval_tokens(task_id);

    CREATE TABLE IF NOT EXISTS task_ci_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      repository TEXT NOT NULL,
      workflow_run_id TEXT NOT NULL,
      workflow_name TEXT,
      head_sha TEXT,
      status TEXT NOT NULL,
      conclusion TEXT,
      html_url TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(repository, workflow_run_id),
      FOREIGN KEY(task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_task_ci_runs_task_id ON task_ci_runs(task_id, updated_at);

    CREATE TABLE IF NOT EXISTS task_ci_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_ci_run_id INTEGER NOT NULL,
      job_id TEXT NOT NULL,
      job_name TEXT NOT NULL,
      status TEXT,
      conclusion TEXT,
      html_url TEXT,
      failed_step TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(task_ci_run_id, job_id),
      FOREIGN KEY(task_ci_run_id) REFERENCES task_ci_runs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_task_ci_jobs_run_id ON task_ci_jobs(task_ci_run_id);
  `);

  // Stage B -> Stage D/E migration compatibility
  ensureColumn("tasks", "ci_run_url", "TEXT");
  ensureColumn("tasks", "ci_conclusion", "TEXT");
  ensureColumn("tasks", "ci_head_sha", "TEXT");
  ensureColumn("tasks", "ci_started_at", "TEXT");
  ensureColumn("tasks", "ci_completed_at", "TEXT");
  ensureColumn("tasks", "ci_failed_job", "TEXT");
  ensureColumn("tasks", "ci_failed_step", "TEXT");
  ensureColumn("tasks", "retry_count", "INTEGER NOT NULL DEFAULT 0");
}
