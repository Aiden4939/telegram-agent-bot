import { getDb } from "../db/database.js";

export type UpdateProcessStatus = "received" | "processed" | "duplicate" | "failed";

export interface TelegramUpdateRecord {
  updateId: string;
  chatId: string;
  userId: string;
  messageId: string | null;
  receivedAt: string;
  processedAt: string | null;
  status: UpdateProcessStatus;
  errorCode: string | null;
}

export function registerTelegramUpdate(input: {
  updateId: string;
  chatId: string;
  userId: string;
  messageId?: string | null;
}): { inserted: boolean; record: TelegramUpdateRecord } {
  const db = getDb();
  const inserted = db
    .prepare(
      `INSERT OR IGNORE INTO telegram_updates
       (update_id, chat_id, user_id, message_id, status)
       VALUES (@updateId, @chatId, @userId, @messageId, 'received')`
    )
    .run({
      updateId: input.updateId,
      chatId: input.chatId,
      userId: input.userId,
      messageId: input.messageId ?? null,
    }).changes > 0;

  const row = db
    .prepare(
      `SELECT
         update_id AS updateId,
         chat_id AS chatId,
         user_id AS userId,
         message_id AS messageId,
         received_at AS receivedAt,
         processed_at AS processedAt,
         status,
         error_code AS errorCode
       FROM telegram_updates
       WHERE update_id = ?`
    )
    .get(input.updateId) as TelegramUpdateRecord;

  return { inserted, record: row };
}

export function markTelegramUpdateProcessed(updateId: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE telegram_updates
     SET status = 'processed', processed_at = datetime('now'), error_code = NULL
     WHERE update_id = ?`
  ).run(updateId);
}

export function markTelegramUpdateDuplicate(updateId: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE telegram_updates
     SET status = CASE WHEN status = 'processed' THEN status ELSE 'duplicate' END,
         processed_at = COALESCE(processed_at, datetime('now'))
     WHERE update_id = ?`
  ).run(updateId);
}

export function markTelegramUpdateFailed(updateId: string, errorCode: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE telegram_updates
     SET status = 'failed', processed_at = datetime('now'), error_code = ?
     WHERE update_id = ?`
  ).run(errorCode, updateId);
}
