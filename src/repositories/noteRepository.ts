import { getDb } from "../db/database.js";

export interface NoteRecord {
  id: number;
  chatId: string;
  sourceUrl: string;
  title: string | null;
  summary: string;
  rawText: string | null;
  createdAt: string;
}

export interface CreateNoteInput {
  chatId: string;
  sourceUrl: string;
  title?: string | null;
  summary: string;
  rawText?: string | null;
}

export function createNote(input: CreateNoteInput): NoteRecord {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO notes (chat_id, source_url, title, summary, raw_text)
       VALUES (@chatId, @sourceUrl, @title, @summary, @rawText)`
    )
    .run({
      chatId: input.chatId,
      sourceUrl: input.sourceUrl,
      title: input.title ?? null,
      summary: input.summary,
      rawText: input.rawText ?? null,
    });

  const row = db
    .prepare(
      `SELECT id, chat_id AS chatId, source_url AS sourceUrl, title, summary,
              raw_text AS rawText, created_at AS createdAt
       FROM notes WHERE id = ?`
    )
    .get(result.lastInsertRowid) as NoteRecord;

  return row;
}

export function getNoteById(id: number): NoteRecord | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, chat_id AS chatId, source_url AS sourceUrl, title, summary,
              raw_text AS rawText, created_at AS createdAt
       FROM notes WHERE id = ?`
    )
    .get(id) as NoteRecord | undefined;

  return row ?? null;
}

export function getNoteForChat(id: number, chatId: string): NoteRecord | null {
  const note = getNoteById(id);
  if (!note || note.chatId !== chatId) {
    return null;
  }
  return note;
}

export function listRecentNotes(
  chatId: string,
  limit = 10
): Pick<NoteRecord, "id" | "title" | "sourceUrl" | "createdAt">[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, title, source_url AS sourceUrl, created_at AS createdAt
       FROM notes WHERE chat_id = ?
       ORDER BY id DESC LIMIT ?`
    )
    .all(chatId, limit) as Pick<
    NoteRecord,
    "id" | "title" | "sourceUrl" | "createdAt"
  >[];
}
