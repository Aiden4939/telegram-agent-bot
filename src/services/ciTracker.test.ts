import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tg-ci-test-"));
const dbPath = path.join(tmpDir, "ci.db");

process.env.TELEGRAM_BOT_TOKEN ||= "test-token";
process.env.ALLOWED_TELEGRAM_USER_IDS ||= "1";
process.env.OPENAI_API_KEY ||= "test-key";
process.env.INTERNAL_API_SECRET ||= "test-secret";
process.env.SESSION_DB_PATH = dbPath;
process.env.GITHUB_TOKEN ||= "ghp_testtoken";
process.env.GITHUB_ALLOWED_REPOS = "Aiden4939/telegram-agent-bot";
process.env.TASK_CI_POLL_INTERVAL_SECONDS = "1";
process.env.TASK_CI_MAX_POLLS = "3";

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

test("trackCiForTask moves to READY_FOR_REVIEW on success", async () => {
  await resetDb();
  const { createTask, transitionTaskStatus, getTaskById } = await import(
    "../repositories/taskRepository.js"
  );
  const { trackCiForTask } = await import("./ciTracker.js");

  const task = createTask({
    taskType: "dev",
    requestedBy: "1",
    chatId: "100",
    repository: "Aiden4939/telegram-agent-bot",
    baseBranch: "main",
    workingBranch: "agent/test",
    originalRequest: "fix ci",
    status: "CHECKPOINTED",
  });
  transitionTaskStatus({
    taskId: task.taskId,
    toStatus: "DRAFT_PR_OPEN",
    eventType: "DRAFT_PR_CREATED",
    actorType: "system",
    actorId: "test",
    ciHeadSha: "abc123",
    pullRequestUrl: "https://github.com/x/pull/1",
  });

  const originalFetch = global.fetch;
  global.fetch = (async (url: string) => {
    if (url.includes("/actions/runs?")) {
      return new Response(
        JSON.stringify({
          workflow_runs: [
            {
              id: 101,
              name: "CI",
              status: "completed",
              conclusion: "success",
              html_url: "https://github.com/run/101",
              run_started_at: "2026-07-01T00:00:00Z",
              updated_at: "2026-07-01T00:05:00Z",
              head_sha: "abc123",
            },
          ],
        }),
        { status: 200 }
      );
    }
    if (url.includes("/actions/runs/101/jobs")) {
      return new Response(
        JSON.stringify({
          jobs: [
            {
              id: 1,
              name: "test",
              status: "completed",
              conclusion: "success",
              html_url: "https://github.com/job/1",
              steps: [],
            },
          ],
        }),
        { status: 200 }
      );
    }
    throw new Error(`unexpected url ${url}`);
  }) as typeof fetch;

  try {
    await trackCiForTask(task.taskId);
  } finally {
    global.fetch = originalFetch;
  }

  const updated = getTaskById(task.taskId);
  assert.equal(updated?.status, "READY_FOR_REVIEW");
  assert.equal(updated?.ciConclusion, "success");
});
