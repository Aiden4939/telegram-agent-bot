import assert from "node:assert/strict";
import test from "node:test";
import type { TaskRecord } from "../types/task.js";

process.env.TELEGRAM_BOT_TOKEN ||= "test-token";
process.env.ALLOWED_TELEGRAM_USER_IDS ||= "1";
process.env.OPENAI_API_KEY ||= "test-key";
process.env.INTERNAL_API_SECRET ||= "test-secret";

function mockTask(partial: Partial<TaskRecord>): TaskRecord {
  return {
    taskId: "t1",
    taskType: "dev",
    requestedBy: "1",
    chatId: "1",
    sourceUpdateId: null,
    sourceMessageId: null,
    repository: "foo/bar",
    baseBranch: "main",
    workingBranch: "agent/test",
    pullRequestUrl: null,
    agentId: null,
    status: "RUNNING",
    approvalStatus: "approved",
    originalRequest: "x",
    progressSummary: null,
    completedItemsJson: "[]",
    remainingItemsJson: "[]",
    pendingQuestion: null,
    lastCommitSha: null,
    ciStatus: null,
    estimatedCost: 0,
    actualCost: 0,
    modelCallCount: 0,
    toolCallCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    expiresAt: null,
    lastHeartbeatAt: new Date().toISOString(),
    errorCode: null,
    errorSummary: null,
    ...partial,
  };
}

test("budget guard rejects excessive model calls", async () => {
  const { validateTaskBudget } = await import("./taskBudgetService.js");
  const result = validateTaskBudget(mockTask({ modelCallCount: 99999 }));
  assert.equal(result.ok, false);
});

test("budget guard allows low-usage task", async () => {
  const { validateTaskBudget } = await import("./taskBudgetService.js");
  const result = validateTaskBudget(mockTask({ modelCallCount: 1, toolCallCount: 1 }));
  assert.equal(result.ok, true);
});
