import { Router, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { createNote } from "../repositories/noteRepository.js";

export const internalNotesRouter = Router();

interface CreateNoteBody {
  chatId: string | number;
  sourceUrl: string;
  title?: string | null;
  summary: string;
  rawText?: string | null;
}

function verifySecret(req: Request, res: Response): boolean {
  const secret = req.headers["x-internal-secret"];
  if (secret !== env.internalApiSecret) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

internalNotesRouter.post("/", (req: Request, res: Response) => {
  if (!verifySecret(req, res)) {
    return;
  }

  const body = req.body as CreateNoteBody;
  if (!body.chatId || !body.sourceUrl || !body.summary) {
    res.status(400).json({
      ok: false,
      error: "chatId, sourceUrl, and summary are required",
    });
    return;
  }

  const note = createNote({
    chatId: String(body.chatId),
    sourceUrl: body.sourceUrl,
    title: body.title,
    summary: body.summary,
    rawText: body.rawText,
  });

  res.json({ ok: true, noteId: note.id, note });
});
