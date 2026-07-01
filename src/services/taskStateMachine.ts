import type { TaskStatus } from "../types/task.js";

const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  RECEIVED: ["CLASSIFIED", "FAILED", "CANCELLED"],
  CLASSIFIED: ["AWAITING_PLAN_APPROVAL", "RUNNING", "FAILED", "CANCELLED"],
  AWAITING_PLAN_APPROVAL: ["RUNNING", "PAUSED", "CANCELLED", "TIMED_OUT"],
  RUNNING: [
    "AWAITING_USER_INPUT",
    "CHECKPOINTED",
    "DRAFT_PR_OPEN",
    "CI_RUNNING",
    "READY_FOR_REVIEW",
    "PAUSED",
    "FAILED",
    "CANCELLED",
    "BUDGET_EXCEEDED",
    "TIMED_OUT",
    "COMPLETED",
  ],
  AWAITING_USER_INPUT: ["RUNNING", "PAUSED", "CANCELLED", "TIMED_OUT"],
  CHECKPOINTED: ["RUNNING", "DRAFT_PR_OPEN", "PAUSED", "CANCELLED", "TIMED_OUT"],
  DRAFT_PR_OPEN: ["CI_RUNNING", "READY_FOR_REVIEW", "PAUSED", "FAILED", "CANCELLED"],
  CI_RUNNING: ["CI_FAILED", "READY_FOR_REVIEW", "PAUSED", "FAILED", "TIMED_OUT"],
  CI_FAILED: ["RUNNING", "PAUSED", "CANCELLED", "FAILED"],
  READY_FOR_REVIEW: ["COMPLETED", "RUNNING", "PAUSED", "CANCELLED"],
  PAUSED: ["RUNNING", "CANCELLED", "FAILED", "TIMED_OUT", "COMPLETED"],
  FAILED: ["PAUSED"],
  CANCELLED: [],
  BUDGET_EXCEEDED: ["PAUSED", "RUNNING", "CANCELLED"],
  TIMED_OUT: ["PAUSED", "RUNNING", "CANCELLED"],
  COMPLETED: [],
};

export function canTransitionTaskStatus(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTaskStatusTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransitionTaskStatus(from, to)) {
    throw new Error(`Illegal task status transition: ${from} -> ${to}`);
  }
}
