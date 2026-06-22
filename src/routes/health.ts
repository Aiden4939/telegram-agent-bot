import { Router, type Request, type Response } from "express";
import { getDb } from "../db/database.js";

export const healthRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
  try {
    getDb().prepare("SELECT 1").get();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});
