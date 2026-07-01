# GitHub Permissions (Minimum)

## Required

- Metadata: Read
- Contents: Read
- Pull requests: Read and Write (draft PR create/reuse only)
- Actions: Read (workflow run/job tracking)

## Explicitly Not Used

- administration
- secrets / variables / environments write
- workflow write
- merge APIs
- deployment APIs
- release/tag APIs

## Runtime Guard

Application code does not expose merge/deploy operations and only uses:

- `POST /repos/{owner}/{repo}/pulls` (draft only)
- `GET /pulls` (reuse check)
- `GET /actions/runs`
- `GET /actions/runs/{id}/jobs`
