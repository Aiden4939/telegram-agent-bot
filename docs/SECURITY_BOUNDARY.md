# Security Boundary

## Bot Scope

- allowed: create/persist task, call cursor cloud, create/reuse draft PR, query CI state.
- forbidden: merge/deploy/force-push/workflow update/secret mutation.

## Runtime Isolation

- no docker socket
- no host SSH key mount
- no `/workspace` production host mount

## Secret Handling

- all event/log/telegram/pr text pass through redaction
- no raw auth header/token/cookie stored in task events

## Control Plane Rule

Bot is a control plane orchestrator; production rollout remains human-gated.
