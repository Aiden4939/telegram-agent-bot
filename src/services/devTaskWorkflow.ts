import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { sendDevPrompt } from "./agentOrchestrator.js";
import {
  appendTaskEvent,
  countRunningDevTasksByUser,
  countRunningDevTasksGlobal,
  createTask,
  getLatestRecoverableTasksByChat,
  getTaskById,
  transitionTaskStatus,
} from "../repositories/taskRepository.js";
import { createApprovalToken, consumeApprovalToken } from "../repositories/approvalRepository.js";
import { validateTaskBudget } from "./taskBudgetService.js";
import { checkAgentStartInterval } from "./rateLimitService.js";
import type { TaskRecord } from "../types/task.js";

export function buildDevPlanFromRequest(text: string): string[] {
  return [
    "先釐清需求與影響範圍，列出修改檔案。",
    "在白名單 repo 建立工作分支並實作變更。",
    "執行測試/建置並建立 checkpoint。",
    "彙整結果，建立 Draft PR（若具權限）並回報。",
    `原始需求：${text}`,
  ];
}

function resolveRepositoryByText(text: string): string | null {
  const lower = text.toLowerCase();
  const matched = env.cloudRepos.find((repo) => {
    const name = repo.split("/")[1]?.toLowerCase();
    return name ? lower.includes(name) || lower.includes(repo.toLowerCase()) : false;
  });
  if (matched) {
    return matched;
  }
  return env.cloudRepos.length === 1 ? env.cloudRepos[0] : null;
}

export function createDevTask(input: {
  chatId: string;
  userId: string;
  updateId: string;
  messageId: string;
  text: string;
}): { task: TaskRecord; planLines: string[]; approvalToken: string } {
  const repo = resolveRepositoryByText(input.text);
  if (!repo) {
    throw new Error("無法判斷 repository。請在訊息中指定 repo 名稱。");
  }

  const userRunning = countRunningDevTasksByUser(input.userId);
  if (userRunning >= env.userConcurrentDevTaskLimit) {
    throw new Error("你已有進行中的 dev 任務，請先 /pause 或 /cancel。");
  }
  const globalRunning = countRunningDevTasksGlobal();
  if (globalRunning >= env.globalConcurrentAgentLimit) {
    throw new Error("目前系統忙碌，稍後再試。");
  }

  const planLines = buildDevPlanFromRequest(input.text);
  const task = createTask({
    taskType: "dev",
    requestedBy: input.userId,
    chatId: input.chatId,
    sourceUpdateId: input.updateId,
    sourceMessageId: input.messageId,
    repository: repo,
    baseBranch: env.cloudBaseBranch,
    workingBranch: `agent/${Date.now()}-${randomUUID().slice(0, 8)}`,
    originalRequest: input.text,
    status: "CLASSIFIED",
    approvalStatus: "pending",
  });

  transitionTaskStatus({
    taskId: task.taskId,
    toStatus: "AWAITING_PLAN_APPROVAL",
    eventType: "PLAN_CREATED",
    actorType: "system",
    actorId: "planner",
    progressSummary: "Plan 已產生，等待使用者確認。",
    remainingItemsJson: JSON.stringify(planLines),
    payload: { planLines, repository: repo },
  });

  const tokenRecord = createApprovalToken({
    taskId: task.taskId,
    action: "approve_plan",
    telegramUserId: input.userId,
    ttlMs: env.taskApprovalTtlMs,
  });
  appendTaskEvent({
    taskId: task.taskId,
    eventType: "APPROVAL_REQUESTED",
    actorType: "system",
    actorId: "bot",
    payload: { expiresAt: tokenRecord.expiresAt },
  });
  const latest = getTaskById(task.taskId);
  if (!latest) {
    throw new Error("Task not found after creation");
  }
  return { task: latest, planLines, approvalToken: tokenRecord.token };
}

export async function approveAndRunDevTask(input: {
  taskId: string;
  approvalToken: string;
  userId: string;
}): Promise<TaskRecord> {
  const consumed = consumeApprovalToken({
    token: input.approvalToken,
    taskId: input.taskId,
    action: "approve_plan",
    telegramUserId: input.userId,
  });
  if (!consumed.ok) {
    throw new Error(`approval failed: ${consumed.reason}`);
  }

  const task = getTaskById(input.taskId);
  if (!task) {
    throw new Error("task_not_found");
  }
  if (task.status !== "AWAITING_PLAN_APPROVAL") {
    throw new Error(`task_not_awaiting_approval:${task.status}`);
  }

  const interval = checkAgentStartInterval(input.userId);
  if (!interval.ok) {
    throw new Error(`agent_start_rate_limited:${interval.retryAfterSec}`);
  }

  transitionTaskStatus({
    taskId: task.taskId,
    toStatus: "RUNNING",
    eventType: "APPROVAL_GRANTED",
    actorType: "user",
    actorId: input.userId,
    approvalStatus: "approved",
    payload: { action: "approve_plan" },
  });

  const prompt = [
    `Task ID: ${task.taskId}`,
    `Original Request: ${task.originalRequest}`,
    `Repository: ${task.repository}`,
    `Base Branch: ${task.baseBranch ?? "main"}`,
    `Working Branch: ${task.workingBranch}`,
    "Forbidden Paths: .env, .env.*, secrets/**, .github/workflows/**",
    "Rules: No merge, no deploy, no secret access.",
    "請先給出實作計畫，再執行修改與測試，最後提供 Draft PR 所需內容。",
  ].join("\n");

  const result = await sendDevPrompt(task.chatId, prompt);
  const estimate = Math.max(0.01, Math.round((result.text.length / 1200) * 100) / 100);

  const afterRun = transitionTaskStatus({
    taskId: task.taskId,
    toStatus: "CHECKPOINTED",
    eventType: "CHECKPOINT_CREATED",
    actorType: "agent",
    actorId: result.agentId,
    agentId: result.agentId,
    progressSummary: "Agent 已完成一輪執行並建立 checkpoint。",
    completedItemsJson: JSON.stringify(["完成第一輪實作/輸出"]),
    remainingItemsJson: JSON.stringify(["建立 Draft PR", "確認 CI 結果"]),
    modelCallDelta: 1,
    estimatedCostDelta: estimate,
    payload: { responsePreview: result.text.slice(0, 500) },
  });

  const budget = validateTaskBudget(afterRun);
  if (!budget.ok) {
    return transitionTaskStatus({
      taskId: task.taskId,
      toStatus: "BUDGET_EXCEEDED",
      eventType: "BUDGET_EXCEEDED",
      actorType: "system",
      actorId: "budget_guard",
      errorCode: budget.reason ?? "budget_exceeded",
      errorSummary: "Budget guardrail hit",
    });
  }
  return afterRun;
}

export function rejectDevTask(taskId: string, userId: string): TaskRecord {
  return transitionTaskStatus({
    taskId,
    toStatus: "CANCELLED",
    eventType: "APPROVAL_REJECTED",
    actorType: "user",
    actorId: userId,
    approvalStatus: "rejected",
    errorCode: "approval_rejected",
    errorSummary: "使用者取消執行計畫",
  });
}

export function pauseTask(taskId: string, actorId: string): TaskRecord {
  const task = getTaskById(taskId);
  if (!task) {
    throw new Error("task_not_found");
  }
  if (task.status === "PAUSED") {
    return task;
  }
  return transitionTaskStatus({
    taskId,
    toStatus: "PAUSED",
    eventType: "TASK_PAUSED",
    actorType: "user",
    actorId,
  });
}

export function cancelTask(taskId: string, actorId: string): TaskRecord {
  const task = getTaskById(taskId);
  if (!task) {
    throw new Error("task_not_found");
  }
  if (task.status === "CANCELLED") {
    return task;
  }
  return transitionTaskStatus({
    taskId,
    toStatus: "CANCELLED",
    eventType: "TASK_CANCELLED",
    actorType: "user",
    actorId,
  });
}

export function getRecoverableTaskChoices(chatId: string): TaskRecord[] {
  return getLatestRecoverableTasksByChat(chatId);
}
