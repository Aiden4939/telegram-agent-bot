export const GITHUB_ACTIONS = ["list_issues", "list_prs", "unknown"] as const;

export type GitHubAction = (typeof GITHUB_ACTIONS)[number];

export type GitHubIssueState = "open" | "closed" | "all";

export interface GitHubPlan {
  action: GitHubAction;
  repo?: string;
  state?: GitHubIssueState;
}

export interface GitHubResult {
  ok: boolean;
  action: string;
  summary: string;
  detail: string;
}
