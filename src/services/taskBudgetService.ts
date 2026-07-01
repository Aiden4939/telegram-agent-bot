import { env } from "../config/env.js";
import type { TaskRecord } from "../types/task.js";

export function validateTaskBudget(task: TaskRecord): { ok: boolean; reason?: string } {
  if (task.modelCallCount >= env.taskMaxModelCalls) {
    return { ok: false, reason: "model_call_limit" };
  }
  if (task.toolCallCount >= env.taskMaxToolCalls) {
    return { ok: false, reason: "tool_call_limit" };
  }
  if (task.estimatedCost >= env.taskMaxEstimatedCost) {
    return { ok: false, reason: "estimated_cost_limit" };
  }
  if (task.startedAt) {
    const started = new Date(task.startedAt).getTime();
    if (Number.isFinite(started) && Date.now() - started >= env.taskMaxRuntimeMs) {
      return { ok: false, reason: "runtime_limit" };
    }
  }
  return { ok: true };
}
