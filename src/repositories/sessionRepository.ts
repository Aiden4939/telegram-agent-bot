import { getDb } from "../db/database.js";

export interface SessionRecord {
  chatId: string;
  agentId: string | null;
  cwd: string;
  status: string;
  updatedAt: string;
}

export function getSession(chatId: string): SessionRecord | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT chat_id AS chatId, agent_id AS agentId, cwd, status, updated_at AS updatedAt
       FROM telegram_sessions WHERE chat_id = ?`
    )
    .get(chatId) as SessionRecord | undefined;

  return row ?? null;
}

export function upsertSession(input: {
  chatId: string;
  agentId: string | null;
  cwd: string;
  status: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO telegram_sessions (chat_id, agent_id, cwd, status, updated_at)
     VALUES (@chatId, @agentId, @cwd, @status, datetime('now'))
     ON CONFLICT(chat_id) DO UPDATE SET
       agent_id = excluded.agent_id,
       cwd = excluded.cwd,
       status = excluded.status,
       updated_at = datetime('now')`
  ).run(input);
}

export function clearSession(chatId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM telegram_sessions WHERE chat_id = ?`).run(chatId);
}

export function updateSessionCwd(chatId: string, cwd: string): void {
  const existing = getSession(chatId);
  upsertSession({
    chatId,
    agentId: null,
    cwd,
    status: existing?.status ?? "idle",
  });
}

export function recoverStaleSessions(): number {
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE telegram_sessions
       SET status = 'idle', updated_at = datetime('now')
       WHERE status = 'running'`
    )
    .run();
  return result.changes;
}
