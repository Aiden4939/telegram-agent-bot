# Agent Resume

## Resume Strategy

When retrying CI fix or continuing paused task:

1. attempt `Agent.resume(existingAgentId)`
2. if provider resume fails, run reconstruction on existing task branch
3. keep same task id and same PR

## Reconstruction Context

- original request
- approved plan
- repository/base/working branch
- current PR url
- checkpoint summary
- latest CI failure summary

## Limits

- `TASK_MAX_AGENT_RESUMES`
- `TASK_MAX_CI_FIX_ATTEMPTS`

Exceeding limit transitions task to `PAUSED` for manual handling.
