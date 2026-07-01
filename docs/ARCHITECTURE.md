# Architecture

## Components

- Telegram Bot (`grammy`)
- HTTP app (`express`)
- SQLite persistence (`better-sqlite3`)
- Cursor SDK adapter (`agentOrchestrator`)
- Task domain (`tasks`, `task_events`, `approval_tokens`, `telegram_updates`)
- GitHub read-only executor

## Persistence Layers

- `telegram_sessions`: agent session metadata
- `telegram_updates`: dedup and processing trace
- `tasks`: lifecycle, budget, workflow metadata
- `task_events`: append-only audit trail
- `approval_tokens`: single-use approval gate

## Reliability Controls

- WAL + foreign keys + busy timeout
- transactional status/event updates
- startup stale task recovery
- dedup by `update_id`
- explicit state machine validation

## Security Controls

- webhook requires cloud runtime
- docker ops default disabled
- centralized secret redaction
- repository allowlist and constraints in dev workflow
