# CI Tracking

## Data Model

- `tasks` keeps current CI snapshot (`ci_run_id`, `ci_status`, `ci_conclusion`, failed job/step).
- `task_ci_runs` stores discovered workflow runs (unique by `repository + workflow_run_id`).
- `task_ci_jobs` stores job-level detail (unique by `task_ci_run_id + job_id`).

## Polling

Config:

- `TASK_CI_POLL_INTERVAL_SECONDS`
- `TASK_CI_TIMEOUT_SECONDS`
- `TASK_CI_MAX_POLLS`

Behavior:

- only one poller per task (`activePollers`)
- status transition events only at major boundary
- startup recovery scans `DRAFT_PR_OPEN`/`CI_RUNNING` tasks and resumes tracking

## Status Mapping

- discovered run -> `CI_RUNNING`
- success -> `READY_FOR_REVIEW`
- failure -> `CI_FAILED`
- cancelled -> `PAUSED`
- polling timeout -> `TIMED_OUT`
