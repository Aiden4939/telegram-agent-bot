# Task State Machine

## States

`RECEIVED` -> `CLASSIFIED` -> `AWAITING_PLAN_APPROVAL` -> `RUNNING` -> `CHECKPOINTED` -> `DRAFT_PR_OPEN` -> `CI_RUNNING` -> `READY_FOR_REVIEW` -> `COMPLETED`

Auxiliary states:

- `AWAITING_USER_INPUT`
- `PAUSED`
- `CI_FAILED`
- `FAILED`
- `CANCELLED`
- `BUDGET_EXCEEDED`
- `TIMED_OUT`

## Guard Rules

- All transitions are validated in `taskStateMachine`.
- Illegal jumps are rejected (example: `RECEIVED -> COMPLETED`).
- Task status update and event append run in one SQLite transaction.

## Recovery

- On startup, stale `RUNNING` tasks (heartbeat expired) move to `PAUSED`.
- Resume operates from persisted task record, not in-memory run object.
