import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tg-devwf-test-"));
const dbPath = path.join(tmpDir, "devwf.db");

process.env.TELEGRAM_BOT_TOKEN ||= "test-token";
process.env.ALLOWED_TELEGRAM_USER_IDS ||= "1";
process.env.OPENAI_API_KEY ||= "test-key";
process.env.INTERNAL_API_SECRET ||= "test-secret";
process.env.CLOUD_REPOS = "Aiden4939/telegram-agent-bot";
process.env.DEV_RUNTIME = "cloud";
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

test("createDevTask rejects .env and workflow modification requests", async () => {
  await resetDb();
  const { createDevTask } = await import("./devTaskWorkflow.js");

  assert.throws(
    () =>
      createDevTask({
        chatId: "1",
        userId: "1",
        updateId: "u1",
        messageId: "m1",
        text: "/dev 幫我修改 .env",
      }),
    /forbidden_request:\.env/
  );

  assert.throws(
    () =>
      createDevTask({
        chatId: "1",
        userId: "1",
        updateId: "u2",
        messageId: "m2",
        text: "請修改 .github/workflows/docker.yml",
      }),
    /forbidden_request:workflow/
  );
});
