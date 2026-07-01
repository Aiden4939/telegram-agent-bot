import { env } from "../config/env.js";
import type { GitHubPlan, GitHubResult } from "../types/github.js";
import { resolveAllowedRepo } from "../utils/githubRepo.js";

const GITHUB_API = "https://api.github.com";

function getGithubToken(): string {
  return process.env.GITHUB_TOKEN?.trim() || "";
}

function getGithubAllowedRepos(): string[] {
  const raw = process.env.GITHUB_ALLOWED_REPOS?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const GITHUB_HELP = [
  "目前支援的 GitHub 查詢：",
  "• 列出 issues（list_issues）",
  "• 列出 Pull Requests（list_prs）",
].join("\n");

interface GitHubIssueItem {
  number: number;
  title: string;
  state: string;
  html_url: string;
  pull_request?: unknown;
}

async function githubFetch(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "telegram-agent-bot",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (getGithubToken()) {
    headers.Authorization = `Bearer ${getGithubToken()}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.opsCommandTimeoutMs);

  try {
    return await fetch(`${GITHUB_API}${path}`, {
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function assertGitHubConfigured(): void {
  if (!getGithubToken()) {
    throw new Error(
      "尚未設定 GITHUB_TOKEN，無法查詢 GitHub。請在 .env 填入 read-only token。"
    );
  }

  if (getGithubAllowedRepos().length === 0) {
    throw new Error(
      "尚未設定 GITHUB_ALLOWED_REPOS，無法查詢 GitHub。請填入允許的 owner/repo。"
    );
  }
}

function resolveRepo(plan: GitHubPlan, textHint?: string): string {
  const allowedRepos = getGithubAllowedRepos();
  const candidate = plan.repo?.trim();
  if (candidate) {
    const matched = allowedRepos.find(
      (repo) => repo.toLowerCase() === candidate.toLowerCase()
    );
    if (!matched) {
      throw new Error(
        `repo ${candidate} 不在允許清單：${allowedRepos.join(", ")}`
      );
    }
    return matched;
  }

  if (textHint) {
    const resolved = resolveAllowedRepo(textHint, allowedRepos);
    if (resolved) {
      return resolved;
    }
  }

  throw new Error(
    "無法判斷要查詢的 repo。請指定 owner/repo 或只保留一個 GITHUB_ALLOWED_REPOS。"
  );
}

function formatIssueLines(items: GitHubIssueItem[], includePr: boolean): string {
  const filtered = includePr
    ? items
    : items.filter((item) => !item.pull_request);

  if (filtered.length === 0) {
    return "（無符合條件的項目）";
  }

  return filtered
    .slice(0, env.githubIssueLimit)
    .map((item) => `#${item.number} [${item.state}] ${item.title}`)
    .join("\n");
}

async function listIssues(plan: GitHubPlan): Promise<GitHubResult> {
  const repo = resolveRepo(plan);
  const state = plan.state ?? "open";
  const response = await githubFetch(
    `/repos/${repo}/issues?state=${state}&per_page=${env.githubIssueLimit}&sort=updated&direction=desc`
  );

  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    return {
      ok: false,
      action: "list_issues",
      summary: `GitHub API 失敗 (${response.status})`,
      detail: body || response.statusText,
    };
  }

  const items = (await response.json()) as GitHubIssueItem[];
  const detail = formatIssueLines(items, false);

  return {
    ok: true,
    action: "list_issues",
    summary: `${repo} 的 ${state} issues（最多 ${env.githubIssueLimit} 筆）`,
    detail,
  };
}

async function listPullRequests(plan: GitHubPlan): Promise<GitHubResult> {
  const repo = resolveRepo(plan);
  const state = plan.state ?? "open";
  const response = await githubFetch(
    `/repos/${repo}/pulls?state=${state}&per_page=${env.githubIssueLimit}&sort=updated&direction=desc`
  );

  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    return {
      ok: false,
      action: "list_prs",
      summary: `GitHub API 失敗 (${response.status})`,
      detail: body || response.statusText,
    };
  }

  const items = (await response.json()) as Array<{
    number: number;
    title: string;
    state: string;
  }>;

  const detail =
    items.length === 0
      ? "（無符合條件的 PR）"
      : items
          .slice(0, env.githubIssueLimit)
          .map((item) => `#${item.number} [${item.state}] ${item.title}`)
          .join("\n");

  return {
    ok: true,
    action: "list_prs",
    summary: `${repo} 的 ${state} PR（最多 ${env.githubIssueLimit} 筆）`,
    detail,
  };
}

export function formatGitHubResult(result: GitHubResult): string {
  const status = result.ok ? "成功" : "失敗";
  return [`github ${result.action}：${status}`, result.summary, "", result.detail].join(
    "\n"
  );
}

export async function executeGitHubPlan(plan: GitHubPlan): Promise<GitHubResult> {
  try {
    assertGitHubConfigured();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      action: plan.action,
      summary: "GitHub 查詢未設定",
      detail: message,
    };
  }

  if (plan.action === "unknown") {
    return {
      ok: false,
      action: "unknown",
      summary: "無法判斷 GitHub 查詢動作",
      detail: GITHUB_HELP,
    };
  }

  switch (plan.action) {
    case "list_issues":
      return listIssues(plan);
    case "list_prs":
      return listPullRequests(plan);
    default:
      return {
        ok: false,
        action: plan.action,
        summary: "不支援的 GitHub 動作",
        detail: GITHUB_HELP,
      };
  }
}
