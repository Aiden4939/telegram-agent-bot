import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tg-bot-test-"));
const dbPath = path.join(tmpDir, "bot.db");

process.env.TELEGRAM_BOT_TOKEN ||= "test-token";
process.env.ALLOWED_TELEGRAM_USER_IDS ||= "1";
process.env.OPENAI_API_KEY ||= "test-key";
process.env.INTERNAL_API_SECRET ||= "test-secret";
process.env.SESSION_DB_PATH = dbPath;
process.env.DEFAULT_CWD = tmpDir;

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

test("clearChatTaskLocks removes scrape and dev pending locks", async () => {
  const {
    markScrapeBusy,
    markPendingDev,
    markPendingOps,
    isChatTaskLocked,
    clearChatTaskLocks,
  } = await import("./chatTaskState.js");

  const chatId = 42;
  markScrapeBusy(chatId);
  markPendingDev(chatId);
  markPendingOps(chatId);
  assert.equal(isChatTaskLocked(chatId), true);

  const result = clearChatTaskLocks(chatId);
  assert.equal(result.scrapeLockCleared, true);
  assert.equal(result.devLockCleared, true);
  assert.equal(result.opsLockCleared, true);
  assert.equal(isChatTaskLocked(chatId), false);
});

test("clearChatTaskLocks is idempotent when no locks exist", async () => {
  const { clearChatTaskLocks } = await import("./chatTaskState.js");

  const result = clearChatTaskLocks(999);
  assert.equal(result.scrapeLockCleared, false);
  assert.equal(result.devLockCleared, false);
  assert.equal(result.opsLockCleared, false);
});

test("formatForceResetMessage describes session recovery", async () => {
  const { formatForceResetMessage } = await import("./forceReset.js");

  const message = formatForceResetMessage({
    devRunCancelled: false,
    hadActiveRun: false,
    sessionReset: true,
    previousSessionStatus: "running",
    scrapeLockCleared: false,
    devLockCleared: true,
    opsLockCleared: false,
  });

  assert.match(message, /session：running → idle/);
  assert.match(message, /dev pending 鎖/);
  assert.match(message, /\/status/);
});

test("formatForceResetMessage suggests container restart when scrape lock cleared", async () => {
  const { formatForceResetMessage } = await import("./forceReset.js");

  const message = formatForceResetMessage({
    devRunCancelled: false,
    hadActiveRun: false,
    sessionReset: false,
    previousSessionStatus: "idle",
    scrapeLockCleared: true,
    devLockCleared: false,
    opsLockCleared: false,
  });

  assert.match(message, /docker compose restart telegram-bot/);
});

test("forceResetDev resets stale running session in SQLite", async () => {
  await resetDb();

  const { upsertSession, getSession } = await import(
    "../repositories/sessionRepository.js"
  );
  const { forceResetDev, clearActiveRunsForTest } = await import(
    "./agentOrchestrator.js"
  );

  clearActiveRunsForTest();

  upsertSession({
    chatId: "8211354317",
    agentId: null,
    cwd: tmpDir,
    status: "running",
  });

  const result = await forceResetDev("8211354317");
  assert.equal(result.sessionReset, true);
  assert.equal(result.previousSessionStatus, "running");
  assert.equal(result.hadActiveRun, false);

  const session = getSession("8211354317");
  assert.equal(session?.status, "idle");
  assert.equal(session?.agentId, null);
});

test("forceResetDev cancels active run when supported", async () => {
  await resetDb();

  const { upsertSession } = await import("../repositories/sessionRepository.js");
  const {
    forceResetDev,
    setActiveRunForTest,
    clearActiveRunsForTest,
    isDevRunActive,
  } = await import("./agentOrchestrator.js");

  clearActiveRunsForTest();

  upsertSession({
    chatId: "100",
    agentId: "agent-test",
    cwd: tmpDir,
    status: "running",
  });

  let cancelled = false;
  setActiveRunForTest("100", {
    supports: (op) => op === "cancel",
    cancel: async () => {
      cancelled = true;
    },
  });

  const result = await forceResetDev("100");
  assert.equal(cancelled, true);
  assert.equal(result.devRunCancelled, true);
  assert.equal(result.hadActiveRun, true);
  assert.equal(isDevRunActive("100"), false);
});

test("performForceReset clears in-memory locks and stale session", async () => {
  await resetDb();

  const { upsertSession, getSession } = await import(
    "../repositories/sessionRepository.js"
  );
  const { markPendingDev, isChatTaskLocked } = await import("./chatTaskState.js");
  const { performForceReset } = await import("./forceReset.js");
  const { clearActiveRunsForTest } = await import("./agentOrchestrator.js");

  clearActiveRunsForTest();

  const chatId = "555";
  markPendingDev(Number(chatId));
  upsertSession({
    chatId,
    agentId: "stale-agent",
    cwd: tmpDir,
    status: "running",
  });

  const report = await performForceReset(chatId);
  assert.equal(report.devLockCleared, true);
  assert.equal(report.sessionReset, true);
  assert.equal(isChatTaskLocked(Number(chatId)), false);
  assert.equal(getSession(chatId)?.status, "idle");
});
