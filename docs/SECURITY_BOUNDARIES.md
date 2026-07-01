# Security Boundaries

## Core Principles

- Telegram Bot is a **control plane**, not a host admin shell.
- Cursor Cloud Agent is treated as an **untrusted worker**.
- Production changes must go through PR/CI/image/deploy pipeline.
- Bot and Agent must not merge, deploy, or access secrets.

## Bot Allowed

- Accept Telegram requests from allowlisted users.
- Classify intent and create persisted tasks.
- Ask for plan approval before dev execution.
- Trigger Cursor Cloud runs on allowlisted repositories only.
- Query GitHub read-only endpoints (issues/PR list).

## Bot Forbidden

- No docker socket access.
- No SSH to production host.
- No arbitrary shell against host.
- No merge/auto-merge/force-push.
- No workflow dispatch for production deploy.
- No direct `.env` read/write.
- No `.github/workflows/**` mutation by runtime workflow.

## Cursor Agent Allowed

- Work only on task-designated repository and working branch.
- Follow plan, run tests, generate checkpoint outputs.
- Produce draft-ready PR content and CI summary metadata.

## Cursor Agent Forbidden

- No merge to `main`/`master`.
- No deploy trigger.
- No secret extraction.
- No forbidden path modifications:
  - `.env`
  - `.env.*`
  - `secrets/**`
  - `.github/workflows/**`

## CI / Deploy Boundary

- Build pipeline: push code -> GHCR image build.
- Deploy pipeline stays manual in infra repository.
- Self-hosted runner must only execute trusted workflows.
