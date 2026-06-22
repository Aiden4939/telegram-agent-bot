import express from "express";
import { healthRouter } from "./routes/health.js";
import { internalNotesRouter } from "./routes/internalNotes.js";

export function createApp(): express.Application {
  const app = express();

  app.use(express.json());
  app.use("/health", healthRouter);
  app.use("/internal/notes", internalNotesRouter);

  return app;
}
