# Production Acceptance Checklist

## Before Deploy

- [ ] Confirm target image digest and current running digest.
- [ ] Pull latest `inwanding-infra` main.
- [ ] Set required env vars:
  - `TELEGRAM_GITHUB_TOKEN`
  - `TELEGRAM_GITHUB_ALLOWED_REPOS`
  - `TELEGRAM_GITHUB_ISSUE_LIMIT`
  - task guardrails (`TASK_MAX_*`, `LOG_MAX_*`)
- [ ] Ensure deploy workflow remains manual.

## Deploy

- [ ] `docker compose pull telegram-playwright telegram-bot`
- [ ] `docker compose up -d telegram-playwright telegram-bot`
- [ ] Health check endpoint returns OK.

## Security Verification

- [ ] `docker inspect svc-telegram-bot` does not include `/var/run/docker.sock`.
- [ ] `docker inspect svc-telegram-bot` does not include `/workspace` host mount.
- [ ] Container env includes `DEV_RUNTIME=cloud`.
- [ ] Bot logs contain no plain secrets (spot check redaction).

## Functional Verification

- [ ] GitHub read query works.
- [ ] `/dev` generates plan and waits for approval.
- [ ] approval callback runs task.
- [ ] `/pause` and `/cancel` change task state.
- [ ] `繼續` can find recoverable task.
