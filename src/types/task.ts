export const TASK_STATUSES = [
  "RECEIVED",
  "CLASSIFIED",
  "AWAITING_PLAN_APPROVAL",
  "RUNNING",
  "AWAITING_USER_INPUT",
  "CHECKPOINTED",
  "DRAFT_PR_OPEN",
  "CI_RUNNING",
  "CI_FAILED",
  "READY_FOR_REVIEW",
  "PAUSED",
  "FAILED",
  "CANCELLED",
  "BUDGET_EXCEEDED",
  "TIMED_OUT",
  "COMPLETED",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type TaskType = "dev" | "ops" | "github" | "scrape" | "chat";

export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

export const TASK_EVENT_TYPES = [
  "TASK_RECEIVED",
  "TASK_CLASSIFIED",
  "PLAN_CREATED",
  "APPROVAL_REQUESTED",
  "APPROVAL_GRANTED",
  "APPROVAL_REJECTED",
  "AGENT_STARTED",
  "AGENT_RESUMED",
  "CHECKPOINT_CREATED",
  "QUESTION_REQUESTED",
  "USER_RESPONSE_RECEIVED",
  "DRAFT_PR_CREATED",
  "DRAFT_PR_REUSED",
  "CI_RUN_DISCOVERED",
  "CI_STARTED",
  "CI_SUCCEEDED",
  "CI_FAILED",
  "TASK_READY_FOR_REVIEW",
  "TASK_PAUSED",
  "TASK_FAILED",
  "TASK_CANCELLED",
  "TASK_COMPLETED",
  "BUDGET_EXCEEDED",
  "TIMEOUT",
] as const;

export type TaskEventType = (typeof TASK_EVENT_TYPES)[number];

export interface TaskRecord {
  taskId: string;
  taskType: TaskType;
  requestedBy: string;
  chatId: string;
  sourceUpdateId: string | null;
  sourceMessageId: string | null;
  repository: string | null;
  baseBranch: string | null;
  workingBranch: string | null;
  pullRequestUrl: string | null;
  pullRequestNumber?: number | null;
  agentId: string | null;
  status: TaskStatus;
  approvalStatus: ApprovalStatus;
  originalRequest: string;
  progressSummary: string | null;
  completedItemsJson: string;
  remainingItemsJson: string;
  pendingQuestion: string | null;
  lastCommitSha: string | null;
  ciStatus: string | null;
  ciRunId?: string | null;
  ciRunUrl?: string | null;
  ciConclusion?: string | null;
  ciHeadSha?: string | null;
  ciStartedAt?: string | null;
  ciCompletedAt?: string | null;
  ciFailedJob?: string | null;
  ciFailedStep?: string | null;
  retryCount?: number;
  estimatedCost: number;
  actualCost: number;
  modelCallCount: number;
  toolCallCount: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  lastHeartbeatAt: string | null;
  errorCode: string | null;
  errorSummary: string | null;
}
