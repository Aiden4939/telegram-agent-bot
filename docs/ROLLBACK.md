# Rollback

## Trigger Conditions

- Critical runtime regression
- Task state corruption
- Approval callback malfunction
- Unexpected security behavior

## Steps

1. Identify previous stable image digest.
2. In infra repo, redeploy telegram-bot with prior digest/tag.
3. Restart only telegram-bot service.
4. Verify `/health`, `/status`, and GitHub read query.
5. Keep SQLite data volume; do not delete task/event records.

## Data Considerations

- `tasks` and `task_events` are append-preserving.
- Rolling back image should not drop DB schema.
- If schema mismatch occurs, pause traffic and run compatibility patch.
