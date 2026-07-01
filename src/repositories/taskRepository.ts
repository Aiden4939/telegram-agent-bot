import { randomUUID } from "node:crypto";
import { getDb } from "../db/database.js";
import { redactJsonPayload } from "../services/redaction.js";
import { assertTaskStatusTransition } from "../services/taskStateMachine.js";
import type {
  ApprovalStatus,
  TaskEventType,
  TaskRecord,
  TaskStatus,
  TaskType,
} from "../types/task.js";

interface CreateTaskInput {
  taskType: TaskType;
  requestedBy: string;
  chatId: string;
  sourceUpdateId?: string;
  sourceMessageId?: string;
  repository?: string;
  baseBranch?: string;
  workingBranch?: string;
  originalRequest: string;
  riskLevel?: string;
  status?: TaskStatus;
  approvalStatus?: ApprovalStatus;
  expiresAt?: string;
}

function mapTaskRow(row: TaskRecord): TaskRecord {
  return row;
}

export function createTask(input: CreateTaskInput): TaskRecord {
  const db = getDb();
  const taskId = randomUUID();
  const status: TaskStatus = input.status ?? "RECEIVED";
  const approvalStatus: ApprovalStatus = input.approvalStatus ?? "not_required";

  const runTx = db.transaction(() => {
    db.prepare(
      `INSERT INTO tasks (
        task_id, task_type, requested_by, chat_id, source_update_id, source_message_id,
        repository, base_branch, working_branch, status, risk_level, approval_status,
        original_request, expires_at, last_heartbeat_at
      ) VALUES (
        @taskId, @taskType, @requestedBy, @chatId, @sourceUpdateId, @sourceMessageId,
        @repository, @baseBranch, @workingBranch, @status, @riskLevel, @approvalStatus,
        @originalRequest, @expiresAt, datetime('now')
      )`
    ).run({
      taskId,
      taskType: input.taskType,
      requestedBy: input.requestedBy,
      chatId: input.chatId,
      sourceUpdateId: input.sourceUpdateId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      repository: input.repository ?? null,
      baseBranch: input.baseBranch ?? null,
      workingBranch: input.workingBranch ?? null,
      status,
      riskLevel: input.riskLevel ?? "normal",
      approvalStatus,
      originalRequest: input.originalRequest,
      expiresAt: input.expiresAt ?? null,
    });

    appendTaskEventInternal({
      eventId: randomUUID(),
      taskId,
      eventType: "TASK_RECEIVED",
      actorType: "system",
      actorId: "bot",
      payload: {
        taskType: input.taskType,
        repository: input.repository ?? null,
      },
    });
  });

  runTx();
  const created = getTaskById(taskId);
  if (!created) {
    throw new Error("Task create failed");
  }
  return created;
}

export function getTaskById(taskId: string): TaskRecord | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
        task_id AS taskId,
        task_type AS taskType,
        requested_by AS requestedBy,
        chat_id AS chatId,
        source_update_id AS sourceUpdateId,
        source_message_id AS sourceMessageId,
        repository,
        base_branch AS baseBranch,
        working_branch AS workingBranch,
        pull_request_number AS pullRequestNumber,
        pull_request_url AS pullRequestUrl,
        agent_id AS agentId,
        status,
        approval_status AS approvalStatus,
        original_request AS originalRequest,
        progress_summary AS progressSummary,
        completed_items_json AS completedItemsJson,
        remaining_items_json AS remainingItemsJson,
        pending_question AS pendingQuestion,
        last_commit_sha AS lastCommitSha,
        ci_run_id AS ciRunId,
        ci_run_url AS ciRunUrl,
        ci_status AS ciStatus,
        ci_conclusion AS ciConclusion,
        ci_head_sha AS ciHeadSha,
        ci_started_at AS ciStartedAt,
        ci_completed_at AS ciCompletedAt,
        ci_failed_job AS ciFailedJob,
        ci_failed_step AS ciFailedStep,
        retry_count AS retryCount,
        estimated_cost AS estimatedCost,
        actual_cost AS actualCost,
        model_call_count AS modelCallCount,
        tool_call_count AS toolCallCount,
        created_at AS createdAt,
        updated_at AS updatedAt,
        started_at AS startedAt,
        completed_at AS completedAt,
        expires_at AS expiresAt,
        last_heartbeat_at AS lastHeartbeatAt,
        error_code AS errorCode,
        error_summary AS errorSummary
       FROM tasks
       WHERE task_id = ?`
    )
    .get(taskId) as TaskRecord | undefined;
  return row ? mapTaskRow(row) : null;
}

export function getLatestRecoverableTasksByChat(chatId: string): TaskRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
        task_id AS taskId,
        task_type AS taskType,
        requested_by AS requestedBy,
        chat_id AS chatId,
        source_update_id AS sourceUpdateId,
        source_message_id AS sourceMessageId,
        repository,
        base_branch AS baseBranch,
        working_branch AS workingBranch,
        pull_request_number AS pullRequestNumber,
        pull_request_url AS pullRequestUrl,
        agent_id AS agentId,
        status,
        approval_status AS approvalStatus,
        original_request AS originalRequest,
        progress_summary AS progressSummary,
        completed_items_json AS completedItemsJson,
        remaining_items_json AS remainingItemsJson,
        pending_question AS pendingQuestion,
        last_commit_sha AS lastCommitSha,
        ci_run_id AS ciRunId,
        ci_run_url AS ciRunUrl,
        ci_status AS ciStatus,
        ci_conclusion AS ciConclusion,
        ci_head_sha AS ciHeadSha,
        ci_started_at AS ciStartedAt,
        ci_completed_at AS ciCompletedAt,
        ci_failed_job AS ciFailedJob,
        ci_failed_step AS ciFailedStep,
        retry_count AS retryCount,
        estimated_cost AS estimatedCost,
        actual_cost AS actualCost,
        model_call_count AS modelCallCount,
        tool_call_count AS toolCallCount,
        created_at AS createdAt,
        updated_at AS updatedAt,
        started_at AS startedAt,
        completed_at AS completedAt,
        expires_at AS expiresAt,
        last_heartbeat_at AS lastHeartbeatAt,
        error_code AS errorCode,
        error_summary AS errorSummary
       FROM tasks
       WHERE chat_id = ?
         AND status IN ('AWAITING_USER_INPUT', 'PAUSED', 'CI_FAILED', 'CHECKPOINTED')
       ORDER BY updated_at DESC`
    )
    .all(chatId) as TaskRecord[];
  return rows.map(mapTaskRow);
}

function appendTaskEventInternal(input: {
  eventId: string;
  taskId: string;
  eventType: TaskEventType;
  actorType: string;
  actorId: string;
  payload?: unknown;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO task_events (event_id, task_id, event_type, actor_type, actor_id, payload_json)
     VALUES (@eventId, @taskId, @eventType, @actorType, @actorId, @payload)`
  ).run({
    eventId: input.eventId,
    taskId: input.taskId,
    eventType: input.eventType,
    actorType: input.actorType,
    actorId: input.actorId,
    payload: redactJsonPayload(input.payload ?? {}),
  });
}

export function appendTaskEvent(input: {
  taskId: string;
  eventType: TaskEventType;
  actorType: string;
  actorId: string;
  payload?: unknown;
}): void {
  appendTaskEventInternal({
    ...input,
    eventId: randomUUID(),
  });
}

export function transitionTaskStatus(input: {
  taskId: string;
  toStatus: TaskStatus;
  eventType: TaskEventType;
  actorType: string;
  actorId: string;
  approvalStatus?: ApprovalStatus;
  progressSummary?: string;
  completedItemsJson?: string;
  remainingItemsJson?: string;
  pendingQuestion?: string | null;
  agentId?: string | null;
  pullRequestUrl?: string | null;
  pullRequestNumber?: number | null;
  lastCommitSha?: string | null;
  ciStatus?: string | null;
  ciRunId?: string | null;
  ciRunUrl?: string | null;
  ciConclusion?: string | null;
  ciHeadSha?: string | null;
  ciStartedAt?: string | null;
  ciCompletedAt?: string | null;
  ciFailedJob?: string | null;
  ciFailedStep?: string | null;
  retryCountDelta?: number;
  errorCode?: string | null;
  errorSummary?: string | null;
  estimatedCostDelta?: number;
  actualCostDelta?: number;
  modelCallDelta?: number;
  toolCallDelta?: number;
  payload?: unknown;
}): TaskRecord {
  const db = getDb();
  const runTx = db.transaction(() => {
    const existing = getTaskById(input.taskId);
    if (!existing) {
      throw new Error(`Task not found: ${input.taskId}`);
    }
    assertTaskStatusTransition(existing.status, input.toStatus);

    db.prepare(
      `UPDATE tasks
       SET status = @toStatus,
           approval_status = COALESCE(@approvalStatus, approval_status),
           progress_summary = COALESCE(@progressSummary, progress_summary),
           completed_items_json = COALESCE(@completedItemsJson, completed_items_json),
           remaining_items_json = COALESCE(@remainingItemsJson, remaining_items_json),
           pending_question = COALESCE(@pendingQuestion, pending_question),
           agent_id = COALESCE(@agentId, agent_id),
           pull_request_number = COALESCE(@pullRequestNumber, pull_request_number),
           pull_request_url = COALESCE(@pullRequestUrl, pull_request_url),
           last_commit_sha = COALESCE(@lastCommitSha, last_commit_sha),
           ci_run_id = COALESCE(@ciRunId, ci_run_id),
           ci_run_url = COALESCE(@ciRunUrl, ci_run_url),
           ci_status = COALESCE(@ciStatus, ci_status),
           ci_conclusion = COALESCE(@ciConclusion, ci_conclusion),
           ci_head_sha = COALESCE(@ciHeadSha, ci_head_sha),
           ci_started_at = COALESCE(@ciStartedAt, ci_started_at),
           ci_completed_at = COALESCE(@ciCompletedAt, ci_completed_at),
           ci_failed_job = COALESCE(@ciFailedJob, ci_failed_job),
           ci_failed_step = COALESCE(@ciFailedStep, ci_failed_step),
           retry_count = retry_count + @retryCountDelta,
           error_code = COALESCE(@errorCode, error_code),
           error_summary = COALESCE(@errorSummary, error_summary),
           estimated_cost = estimated_cost + @estimatedCostDelta,
           actual_cost = actual_cost + @actualCostDelta,
           model_call_count = model_call_count + @modelCallDelta,
           tool_call_count = tool_call_count + @toolCallDelta,
           started_at = CASE WHEN started_at IS NULL AND @toStatus = 'RUNNING' THEN datetime('now') ELSE started_at END,
           completed_at = CASE WHEN @toStatus IN ('FAILED','CANCELLED','TIMED_OUT','BUDGET_EXCEEDED','COMPLETED') THEN datetime('now') ELSE completed_at END,
           last_heartbeat_at = datetime('now'),
           updated_at = datetime('now')
       WHERE task_id = @taskId`
    ).run({
      taskId: input.taskId,
      toStatus: input.toStatus,
      approvalStatus: input.approvalStatus ?? null,
      progressSummary: input.progressSummary ?? null,
      completedItemsJson: input.completedItemsJson ?? null,
      remainingItemsJson: input.remainingItemsJson ?? null,
      pendingQuestion: input.pendingQuestion ?? null,
      agentId: input.agentId ?? null,
      pullRequestUrl: input.pullRequestUrl ?? null,
      pullRequestNumber: input.pullRequestNumber ?? null,
      lastCommitSha: input.lastCommitSha ?? null,
      ciRunId: input.ciRunId ?? null,
      ciRunUrl: input.ciRunUrl ?? null,
      ciStatus: input.ciStatus ?? null,
      ciConclusion: input.ciConclusion ?? null,
      ciHeadSha: input.ciHeadSha ?? null,
      ciStartedAt: input.ciStartedAt ?? null,
      ciCompletedAt: input.ciCompletedAt ?? null,
      ciFailedJob: input.ciFailedJob ?? null,
      ciFailedStep: input.ciFailedStep ?? null,
      retryCountDelta: input.retryCountDelta ?? 0,
      errorCode: input.errorCode ?? null,
      errorSummary: input.errorSummary ?? null,
      estimatedCostDelta: input.estimatedCostDelta ?? 0,
      actualCostDelta: input.actualCostDelta ?? 0,
      modelCallDelta: input.modelCallDelta ?? 0,
      toolCallDelta: input.toolCallDelta ?? 0,
    });

    appendTaskEventInternal({
      eventId: randomUUID(),
      taskId: input.taskId,
      eventType: input.eventType,
      actorType: input.actorType,
      actorId: input.actorId,
      payload: input.payload ?? { toStatus: input.toStatus },
    });
  });

  runTx();
  const updated = getTaskById(input.taskId);
  if (!updated) {
    throw new Error(`Task not found after update: ${input.taskId}`);
  }
  return updated;
}

export function listTaskEvents(taskId: string): Array<{
  eventId: string;
  eventType: string;
  actorType: string;
  actorId: string;
  payloadJson: string;
  createdAt: string;
}> {
  const db = getDb();
  return db
    .prepare(
      `SELECT
        event_id AS eventId,
        event_type AS eventType,
        actor_type AS actorType,
        actor_id AS actorId,
        payload_json AS payloadJson,
        created_at AS createdAt
       FROM task_events
       WHERE task_id = ?
       ORDER BY created_at ASC`
    )
    .all(taskId) as Array<{
    eventId: string;
    eventType: string;
    actorType: string;
    actorId: string;
    payloadJson: string;
    createdAt: string;
  }>;
}

export function findStaleRunningTasks(heartbeatExpiryMs: number): TaskRecord[] {
  const db = getDb();
  const thresholdSeconds = Math.floor(heartbeatExpiryMs / 1000);
  const rows = db
    .prepare(
      `SELECT
        task_id AS taskId,
        task_type AS taskType,
        requested_by AS requestedBy,
        chat_id AS chatId,
        source_update_id AS sourceUpdateId,
        source_message_id AS sourceMessageId,
        repository,
        base_branch AS baseBranch,
        working_branch AS workingBranch,
        pull_request_number AS pullRequestNumber,
        pull_request_url AS pullRequestUrl,
        agent_id AS agentId,
        status,
        approval_status AS approvalStatus,
        original_request AS originalRequest,
        progress_summary AS progressSummary,
        completed_items_json AS completedItemsJson,
        remaining_items_json AS remainingItemsJson,
        pending_question AS pendingQuestion,
        last_commit_sha AS lastCommitSha,
        ci_run_id AS ciRunId,
        ci_run_url AS ciRunUrl,
        ci_status AS ciStatus,
        ci_conclusion AS ciConclusion,
        ci_head_sha AS ciHeadSha,
        ci_started_at AS ciStartedAt,
        ci_completed_at AS ciCompletedAt,
        ci_failed_job AS ciFailedJob,
        ci_failed_step AS ciFailedStep,
        retry_count AS retryCount,
        estimated_cost AS estimatedCost,
        actual_cost AS actualCost,
        model_call_count AS modelCallCount,
        tool_call_count AS toolCallCount,
        created_at AS createdAt,
        updated_at AS updatedAt,
        started_at AS startedAt,
        completed_at AS completedAt,
        expires_at AS expiresAt,
        last_heartbeat_at AS lastHeartbeatAt,
        error_code AS errorCode,
        error_summary AS errorSummary
       FROM tasks
       WHERE status = 'RUNNING'
         AND (
           last_heartbeat_at IS NULL OR
           strftime('%s','now') - strftime('%s', last_heartbeat_at) > ?
         )`
    )
    .all(thresholdSeconds) as TaskRecord[];

  return rows.map(mapTaskRow);
}

export function countRunningDevTasksByUser(userId: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tasks
       WHERE task_type = 'dev' AND requested_by = ? AND status = 'RUNNING'`
    )
    .get(userId) as { count: number };
  return row.count;
}

export function countRunningDevTasksGlobal(): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM tasks
       WHERE task_type = 'dev' AND status = 'RUNNING'`
    )
    .get() as { count: number };
  return row.count;
}

export function getLatestTaskByChat(chatId: string): TaskRecord | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
        task_id AS taskId,
        task_type AS taskType,
        requested_by AS requestedBy,
        chat_id AS chatId,
        source_update_id AS sourceUpdateId,
        source_message_id AS sourceMessageId,
        repository,
        base_branch AS baseBranch,
        working_branch AS workingBranch,
        pull_request_number AS pullRequestNumber,
        pull_request_url AS pullRequestUrl,
        agent_id AS agentId,
        status,
        approval_status AS approvalStatus,
        original_request AS originalRequest,
        progress_summary AS progressSummary,
        completed_items_json AS completedItemsJson,
        remaining_items_json AS remainingItemsJson,
        pending_question AS pendingQuestion,
        last_commit_sha AS lastCommitSha,
        ci_run_id AS ciRunId,
        ci_run_url AS ciRunUrl,
        ci_status AS ciStatus,
        ci_conclusion AS ciConclusion,
        ci_head_sha AS ciHeadSha,
        ci_started_at AS ciStartedAt,
        ci_completed_at AS ciCompletedAt,
        ci_failed_job AS ciFailedJob,
        ci_failed_step AS ciFailedStep,
        retry_count AS retryCount,
        estimated_cost AS estimatedCost,
        actual_cost AS actualCost,
        model_call_count AS modelCallCount,
        tool_call_count AS toolCallCount,
        created_at AS createdAt,
        updated_at AS updatedAt,
        started_at AS startedAt,
        completed_at AS completedAt,
        expires_at AS expiresAt,
        last_heartbeat_at AS lastHeartbeatAt,
        error_code AS errorCode,
        error_summary AS errorSummary
       FROM tasks
       WHERE chat_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`
    )
    .get(chatId) as TaskRecord | undefined;
  return row ? mapTaskRow(row) : null;
}

export function listTasksByStatuses(statuses: TaskStatus[]): TaskRecord[] {
  const db = getDb();
  if (statuses.length === 0) {
    return [];
  }
  const placeholders = statuses.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT
        task_id AS taskId,
        task_type AS taskType,
        requested_by AS requestedBy,
        chat_id AS chatId,
        source_update_id AS sourceUpdateId,
        source_message_id AS sourceMessageId,
        repository,
        base_branch AS baseBranch,
        working_branch AS workingBranch,
        pull_request_number AS pullRequestNumber,
        pull_request_url AS pullRequestUrl,
        agent_id AS agentId,
        status,
        approval_status AS approvalStatus,
        original_request AS originalRequest,
        progress_summary AS progressSummary,
        completed_items_json AS completedItemsJson,
        remaining_items_json AS remainingItemsJson,
        pending_question AS pendingQuestion,
        last_commit_sha AS lastCommitSha,
        ci_run_id AS ciRunId,
        ci_run_url AS ciRunUrl,
        ci_status AS ciStatus,
        ci_conclusion AS ciConclusion,
        ci_head_sha AS ciHeadSha,
        ci_started_at AS ciStartedAt,
        ci_completed_at AS ciCompletedAt,
        ci_failed_job AS ciFailedJob,
        ci_failed_step AS ciFailedStep,
        retry_count AS retryCount,
        estimated_cost AS estimatedCost,
        actual_cost AS actualCost,
        model_call_count AS modelCallCount,
        tool_call_count AS toolCallCount,
        created_at AS createdAt,
        updated_at AS updatedAt,
        started_at AS startedAt,
        completed_at AS completedAt,
        expires_at AS expiresAt,
        last_heartbeat_at AS lastHeartbeatAt,
        error_code AS errorCode,
        error_summary AS errorSummary
       FROM tasks
       WHERE status IN (${placeholders})
       ORDER BY updated_at DESC`
    )
    .all(...statuses) as TaskRecord[];
  return rows.map(mapTaskRow);
}
