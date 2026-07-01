import { getDb } from "../db/database.js";

export interface TaskCiRunInput {
  taskId: string;
  repository: string;
  workflowRunId: string;
  workflowName?: string;
  headSha?: string;
  status: string;
  conclusion?: string | null;
  htmlUrl?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export function upsertTaskCiRun(input: TaskCiRunInput): number {
  const db = getDb();
  db.prepare(
    `INSERT INTO task_ci_runs (
      task_id, repository, workflow_run_id, workflow_name, head_sha, status, conclusion, html_url, started_at, completed_at
    ) VALUES (
      @taskId, @repository, @workflowRunId, @workflowName, @headSha, @status, @conclusion, @htmlUrl, @startedAt, @completedAt
    )
    ON CONFLICT(repository, workflow_run_id) DO UPDATE SET
      status = excluded.status,
      conclusion = excluded.conclusion,
      html_url = excluded.html_url,
      started_at = COALESCE(excluded.started_at, task_ci_runs.started_at),
      completed_at = COALESCE(excluded.completed_at, task_ci_runs.completed_at),
      updated_at = datetime('now')`
  ).run({
    taskId: input.taskId,
    repository: input.repository,
    workflowRunId: input.workflowRunId,
    workflowName: input.workflowName ?? null,
    headSha: input.headSha ?? null,
    status: input.status,
    conclusion: input.conclusion ?? null,
    htmlUrl: input.htmlUrl ?? null,
    startedAt: input.startedAt ?? null,
    completedAt: input.completedAt ?? null,
  });

  const row = db
    .prepare(
      `SELECT id FROM task_ci_runs WHERE repository = ? AND workflow_run_id = ?`
    )
    .get(input.repository, input.workflowRunId) as { id: number };
  return row.id;
}

export function upsertTaskCiJob(input: {
  taskCiRunId: number;
  jobId: string;
  jobName: string;
  status?: string;
  conclusion?: string | null;
  htmlUrl?: string | null;
  failedStep?: string | null;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO task_ci_jobs (
      task_ci_run_id, job_id, job_name, status, conclusion, html_url, failed_step
    ) VALUES (
      @taskCiRunId, @jobId, @jobName, @status, @conclusion, @htmlUrl, @failedStep
    )
    ON CONFLICT(task_ci_run_id, job_id) DO UPDATE SET
      status = excluded.status,
      conclusion = excluded.conclusion,
      html_url = excluded.html_url,
      failed_step = excluded.failed_step,
      updated_at = datetime('now')`
  ).run({
    taskCiRunId: input.taskCiRunId,
    jobId: input.jobId,
    jobName: input.jobName,
    status: input.status ?? null,
    conclusion: input.conclusion ?? null,
    htmlUrl: input.htmlUrl ?? null,
    failedStep: input.failedStep ?? null,
  });
}

export function getLatestFailedJob(taskId: string): {
  workflowName: string | null;
  jobName: string | null;
  failedStep: string | null;
  htmlUrl: string | null;
} | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
        r.workflow_name AS workflowName,
        j.job_name AS jobName,
        j.failed_step AS failedStep,
        COALESCE(j.html_url, r.html_url) AS htmlUrl
       FROM task_ci_runs r
       LEFT JOIN task_ci_jobs j ON j.task_ci_run_id = r.id
       WHERE r.task_id = ?
         AND (j.conclusion = 'failure' OR r.conclusion = 'failure')
       ORDER BY r.updated_at DESC, j.updated_at DESC
       LIMIT 1`
    )
    .get(taskId) as
    | {
        workflowName: string | null;
        jobName: string | null;
        failedStep: string | null;
        htmlUrl: string | null;
      }
    | undefined;
  return row ?? null;
}
