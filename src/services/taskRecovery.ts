import { env } from "../config/env.js";
import { findStaleRunningTasks, transitionTaskStatus } from "../repositories/taskRepository.js";

export function recoverStaleTasks(): number {
  const stale = findStaleRunningTasks(env.taskHeartbeatTimeoutMs);
  for (const task of stale) {
    transitionTaskStatus({
      taskId: task.taskId,
      toStatus: "PAUSED",
      eventType: "TASK_PAUSED",
      actorType: "system",
      actorId: "recovery",
      errorCode: "worker_stale",
      errorSummary: "Detected stale running task; moved to PAUSED for safe resume.",
      payload: {
        previousStatus: task.status,
        agentId: task.agentId,
        branch: task.workingBranch,
      },
    });
  }
  return stale.length;
}
