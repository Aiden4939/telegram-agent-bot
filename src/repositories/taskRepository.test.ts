import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tg-task-test-"));
const dbPath = path.join(tmpDir, "task.db");

process.env.TELEGRAM_BOT_TOKEN ||= "test-token";
process.env.ALLOWED_TELEGRAM_USER_IDS ||= "1";
process.env.OPENAI_API_KEY ||= "test-key";
process.env.INTERNAL_API_SECRET ||= "test-secret";
process.env.SESSION_DB_PATH = dbPath;

test.after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function resetDb(): Promise<void> {
  const { closeDb } = await import("../db/database.js");
  closeDb();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  const { ensureSchema } = await import("../db/schema.js");
  ensureSchema();
}

test("registerTelegramUpdate dedups update id", async () => {
  await resetDb();
  const { registerTelegramUpdate } = await import("./updateRepository.js");

  const first = registerTelegramUpdate({
    updateId: "12345",
    chatId: "100",
    userId: "1",
    messageId: "9",
  });
  const second = registerTelegramUpdate({
    updateId: "12345",
    chatId: "100",
    userId: "1",
    messageId: "9",
  });

  assert.equal(first.inserted, true);
  assert.equal(second.inserted, false);
});

test("transitionTaskStatus writes event in transaction", async () => {
  await resetDb();
  const { createTask, transitionTaskStatus, listTaskEvents } = await import(
    "./taskRepository.js"
  );

  const task = createTask({
    taskType: "dev",
    requestedBy: "1",
    chatId: "100",
    originalRequest: "fix login",
    status: "RECEIVED",
  });

  const moved = transitionTaskStatus({
    taskId: task.taskId,
    toStatus: "CLASSIFIED",
    eventType: "TASK_CLASSIFIED",
    actorType: "system",
    actorId: "test",
  });
  assert.equal(moved.status, "CLASSIFIED");

  const events = listTaskEvents(task.taskId);
  assert.equal(events.length >= 2, true);
  assert.equal(events[events.length - 1]?.eventType, "TASK_CLASSIFIED");
});
