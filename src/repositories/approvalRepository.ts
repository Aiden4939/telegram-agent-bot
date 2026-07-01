import { randomBytes } from "node:crypto";
import { getDb } from "../db/database.js";

export interface ApprovalTokenRecord {
  token: string;
  taskId: string;
  action: string;
  telegramUserId: string;
  expiresAt: string;
  usedAt: string | null;
}

function generateApprovalToken(): string {
  return randomBytes(24).toString("base64url");
}

export function createApprovalToken(input: {
  taskId: string;
  action: string;
  telegramUserId: string;
  ttlMs: number;
}): ApprovalTokenRecord {
  const db = getDb();
  const token = generateApprovalToken();
  const expiresAt = new Date(Date.now() + input.ttlMs).toISOString();
  db.prepare(
    `INSERT INTO approval_tokens (token, task_id, action, telegram_user_id, expires_at)
     VALUES (@token, @taskId, @action, @telegramUserId, @expiresAt)`
  ).run({
    token,
    taskId: input.taskId,
    action: input.action,
    telegramUserId: input.telegramUserId,
    expiresAt,
  });

  return {
    token,
    taskId: input.taskId,
    action: input.action,
    telegramUserId: input.telegramUserId,
    expiresAt,
    usedAt: null,
  };
}

export function consumeApprovalToken(input: {
  token: string;
  taskId: string;
  action: string;
  telegramUserId: string;
}): { ok: boolean; reason?: string } {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT token, task_id AS taskId, action, telegram_user_id AS telegramUserId, expires_at AS expiresAt, used_at AS usedAt
       FROM approval_tokens
       WHERE token = ?`
    )
    .get(input.token) as ApprovalTokenRecord | undefined;

  if (!row) {
    return { ok: false, reason: "token_not_found" };
  }
  if (row.taskId !== input.taskId || row.action !== input.action) {
    return { ok: false, reason: "token_mismatch" };
  }
  if (row.telegramUserId !== input.telegramUserId) {
    return { ok: false, reason: "user_mismatch" };
  }
  if (row.usedAt) {
    return { ok: false, reason: "token_used" };
  }
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: "token_expired" };
  }

  db.prepare(`UPDATE approval_tokens SET used_at = datetime('now') WHERE token = ?`).run(
    input.token
  );
  return { ok: true };
}
