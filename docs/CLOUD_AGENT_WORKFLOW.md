# Cloud Agent Workflow

## Flow

1. Telegram `/dev <request>`
2. Update dedup (`telegram_updates`)
3. Create task (`tasks`)
4. Build plan
5. Ask inline approval (`approve/reject`)
6. On approval: start Cursor Cloud run
7. Save checkpoint (`CHECKPOINTED`)
8. Continue toward draft PR + CI status capture
9. Report to Telegram

## Required Task Context in Prompt

- Task ID
- Original request
- Repository / base branch / working branch
- Confirmed plan
- Forbidden paths
- No-merge / no-deploy constraints

## Resume

- Trigger keyword: `繼續`
- Load recoverable task (`AWAITING_USER_INPUT` / `PAUSED` / `CI_FAILED` / `CHECKPOINTED`)
- If multiple tasks exist, bot asks user to select.

## Pause / Cancel / Status

- `/pause`: checkpoint and set `PAUSED`
- `/cancel`: set `CANCELLED` (does not delete branch/PR)
- `/status`: includes task id/status/repo/pr/cost
