import { env } from "../config/env.js";
import {
  appendTaskEvent,
  getTaskById,
  listTasksByStatuses,
  transitionTaskStatus,
} from "../repositories/taskRepository.js";
import { getWorkflowJobs, getWorkflowRunsByHeadSha } from "./githubWorkflowClient.js";
import { upsertTaskCiJob, upsertTaskCiRun } from "../repositories/taskCiRepository.js";

const activePollers = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function trackCiForTask(taskId: string): Promise<void> {
  if (activePollers.has(taskId)) {
    return;
  }
  activePollers.add(taskId);
  try {
    const task = getTaskById(taskId);
    if (!task?.repository || !task.ciHeadSha) {
      return;
    }

    let pollCount = 0;
    const startedAt = Date.now();
    while (pollCount < env.taskCiMaxPolls) {
      if (Date.now() - startedAt > env.taskCiTimeoutSeconds * 1000) {
        transitionTaskStatus({
          taskId,
          toStatus: "TIMED_OUT",
          eventType: "TIMEOUT",
          actorType: "system",
          actorId: "ci_tracker",
          errorCode: "ci_poll_timeout",
          errorSummary: "CI polling timed out",
        });
        return;
      }
      pollCount += 1;
      const latestTask = getTaskById(taskId);
      if (!latestTask) {
        return;
      }
      if (!["DRAFT_PR_OPEN", "CI_RUNNING"].includes(latestTask.status)) {
        return;
      }
      const headSha = latestTask.ciHeadSha;
      if (!latestTask.repository || !headSha) {
        return;
      }

      const runs = await getWorkflowRunsByHeadSha({
        repo: latestTask.repository,
        headSha,
      });
      const run = runs[0];
      if (!run) {
        await sleep(env.taskCiPollIntervalSeconds * 1000);
        continue;
      }

      const runId = String(run.id);
      const runPkId = upsertTaskCiRun({
        taskId,
        repository: latestTask.repository!,
        workflowRunId: runId,
        workflowName: run.name,
        headSha: run.head_sha,
        status: run.status,
        conclusion: run.conclusion,
        htmlUrl: run.html_url,
        startedAt: run.run_started_at,
        completedAt: run.status === "completed" ? run.updated_at : null,
      });

      if (latestTask.status === "DRAFT_PR_OPEN") {
        appendTaskEvent({
          taskId,
          eventType: "CI_RUN_DISCOVERED",
          actorType: "system",
          actorId: "ci_tracker",
          payload: { workflowName: run.name },
        });
        transitionTaskStatus({
          taskId,
          toStatus: "CI_RUNNING",
          eventType: "CI_STARTED",
          actorType: "system",
          actorId: "ci_tracker",
          ciRunId: runId,
          ciRunUrl: run.html_url,
          ciStatus: run.status,
          ciConclusion: run.conclusion ?? null,
          ciHeadSha: run.head_sha,
          ciStartedAt: run.run_started_at,
          payload: { workflowName: run.name },
        });
      }

      if (run.status !== "completed") {
        await sleep(env.taskCiPollIntervalSeconds * 1000);
        continue;
      }

      const jobs = await getWorkflowJobs({
        repo: latestTask.repository!,
        runId: run.id,
      });
      for (const job of jobs) {
        upsertTaskCiJob({
          taskCiRunId: runPkId,
          jobId: String(job.id),
          jobName: job.name,
          status: job.status,
          conclusion: job.conclusion,
          htmlUrl: job.html_url,
          failedStep: job.failedStep,
        });
      }

      if (run.conclusion === "success") {
        transitionTaskStatus({
          taskId,
          toStatus: "READY_FOR_REVIEW",
          eventType: "CI_SUCCEEDED",
          actorType: "system",
          actorId: "ci_tracker",
          ciRunId: runId,
          ciRunUrl: run.html_url,
          ciStatus: run.status,
          ciConclusion: run.conclusion,
          ciCompletedAt: run.updated_at,
          payload: { workflowName: run.name },
        });
        appendTaskEvent({
          taskId,
          eventType: "TASK_READY_FOR_REVIEW",
          actorType: "system",
          actorId: "ci_tracker",
          payload: { workflowName: run.name },
        });
      } else if (run.conclusion === "cancelled") {
        transitionTaskStatus({
          taskId,
          toStatus: "PAUSED",
          eventType: "TASK_PAUSED",
          actorType: "system",
          actorId: "ci_tracker",
          ciRunId: runId,
          ciRunUrl: run.html_url,
          ciStatus: run.status,
          ciConclusion: run.conclusion,
          ciCompletedAt: run.updated_at,
          errorCode: "ci_cancelled",
          errorSummary: "CI run cancelled",
        });
      } else {
        const failed = jobs.find((j) => j.conclusion === "failure") ?? null;
        transitionTaskStatus({
          taskId,
          toStatus: "CI_FAILED",
          eventType: "CI_FAILED",
          actorType: "system",
          actorId: "ci_tracker",
          ciRunId: runId,
          ciRunUrl: run.html_url,
          ciStatus: run.status,
          ciConclusion: run.conclusion,
          ciCompletedAt: run.updated_at,
          ciFailedJob: failed?.name ?? null,
          ciFailedStep: failed?.failedStep ?? null,
          errorCode: "ci_failed",
          errorSummary: failed
            ? `${failed.name}${failed.failedStep ? ` / ${failed.failedStep}` : ""}`
            : "CI failed",
        });
      }
      return;
    }

    transitionTaskStatus({
      taskId,
      toStatus: "TIMED_OUT",
      eventType: "TIMEOUT",
      actorType: "system",
      actorId: "ci_tracker",
      errorCode: "ci_poll_max_polls",
      errorSummary: "CI polling reached max polls",
    });
  } finally {
    activePollers.delete(taskId);
  }
}

export async function recoverPendingCiTracking(): Promise<void> {
  const tasks = listTasksByStatuses(["DRAFT_PR_OPEN", "CI_RUNNING"]);
  for (const task of tasks) {
    if (!task.repository || !task.ciHeadSha) {
      continue;
    }
    void trackCiForTask(task.taskId);
  }
}
