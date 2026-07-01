# Cloud Development Workflow

## Automated Path

`/dev` request  
-> task created (`RECEIVED` / `CLASSIFIED`)  
-> plan generated  
-> `AWAITING_PLAN_APPROVAL`  
-> inline approval  
-> `RUNNING`  
-> checkpoint (`CHECKPOINTED`)  
-> draft PR create/reuse (`DRAFT_PR_OPEN`)  
-> CI polling (`CI_RUNNING`)  
-> `READY_FOR_REVIEW`

## CI Failure Path

`CI_FAILED` -> bot asks retry decision -> approval token action `ci_failed_decision` -> rerun with resume/fallback.

## Resume Priority

1. try `Agent.resume(agent_id)`
2. if resume fails, create new agent run on same task branch (reconstruction)
3. keep same PR; do not create second PR

## Hard Guards

- no merge
- no deploy
- no force push
- forbidden paths: `.env`, `.env.*`, `.github/workflows/**`, `secrets/**`
