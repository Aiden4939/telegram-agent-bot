import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tg-approval-test-"));
const dbPath = path.join(tmpDir, "approval.db");

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

test("approval token enforces single-use and user binding", async () => {
  await resetDb();
  const { createTask } = await import("./taskRepository.js");
  const { createApprovalToken, consumeApprovalToken } = await import(
    "./approvalRepository.js"
  );

  const task = createTask({
    taskType: "dev",
    requestedBy: "1",
    chatId: "100",
    originalRequest: "fix login",
    status: "CLASSIFIED",
  });
  const token = createApprovalToken({
    taskId: task.taskId,
    action: "approve_plan",
    telegramUserId: "1",
    ttlMs: 60_000,
  });

  const wrongUser = consumeApprovalToken({
    token: token.token,
    taskId: task.taskId,
    action: "approve_plan",
    telegramUserId: "2",
  });
  assert.equal(wrongUser.ok, false);

  const ok = consumeApprovalToken({
    token: token.token,
    taskId: task.taskId,
    action: "approve_plan",
    telegramUserId: "1",
  });
  assert.equal(ok.ok, true);

  const replay = consumeApprovalToken({
    token: token.token,
    taskId: task.taskId,
    action: "approve_plan",
    telegramUserId: "1",
  });
  assert.equal(replay.ok, false);
  assert.equal(replay.reason, "token_used");
});
