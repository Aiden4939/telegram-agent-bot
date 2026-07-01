import { env } from "../config/env.js";
import { redactSecrets } from "./redaction.js";

function assertRepoAllowed(repo: string): void {
  if (!env.githubAllowedRepos.some((r) => r.toLowerCase() === repo.toLowerCase())) {
    throw new Error(`repository_not_allowed:${repo}`);
  }
}

function parseRepo(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    throw new Error(`invalid_repository:${repo}`);
  }
  return { owner, name };
}

async function githubFetch<T>(repo: string, path: string, init?: RequestInit): Promise<T> {
  assertRepoAllowed(repo);
  if (!env.githubToken) {
    throw new Error("github_token_missing");
  }
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "telegram-agent-bot",
      Authorization: `Bearer ${env.githubToken}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`github_${response.status}:${redactSecrets(body).slice(0, 400)}`);
  }
  return (await response.json()) as T;
}

export async function createOrReuseDraftPr(input: {
  repo: string;
  baseBranch: string;
  headBranch: string;
  title: string;
  body: string;
}): Promise<{ number: number; url: string; draft: boolean; reused: boolean; headSha: string }> {
  const { owner, name } = parseRepo(input.repo);
  if (["main", "master"].includes(input.headBranch.toLowerCase())) {
    throw new Error("invalid_head_branch");
  }
  if (input.baseBranch.toLowerCase() === input.headBranch.toLowerCase()) {
    throw new Error("base_head_conflict");
  }

  const existing = await githubFetch<
    Array<{ number: number; html_url: string; draft: boolean; head: { sha: string } }>
  >(
    input.repo,
    `/repos/${owner}/${name}/pulls?state=open&head=${encodeURIComponent(
      `${owner}:${input.headBranch}`
    )}&base=${encodeURIComponent(input.baseBranch)}`
  );
  if (existing.length > 0) {
    return {
      number: existing[0].number,
      url: existing[0].html_url,
      draft: existing[0].draft,
      reused: true,
      headSha: existing[0].head.sha,
    };
  }

  const created = await githubFetch<{
    number: number;
    html_url: string;
    draft: boolean;
    head: { sha: string };
  }>(input.repo, `/repos/${owner}/${name}/pulls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      head: input.headBranch,
      base: input.baseBranch,
      body: input.body,
      draft: true,
    }),
  });

  return {
    number: created.number,
    url: created.html_url,
    draft: created.draft,
    reused: false,
    headSha: created.head.sha,
  };
}

export async function getWorkflowRunsByHeadSha(input: {
  repo: string;
  headSha: string;
}): Promise<
  Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    html_url: string;
    run_started_at: string | null;
    updated_at: string;
    head_sha: string;
  }>
> {
  const { owner, name } = parseRepo(input.repo);
  const result = await githubFetch<{
    workflow_runs: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
      run_started_at: string | null;
      updated_at: string;
      head_sha: string;
    }>;
  }>(
    input.repo,
    `/repos/${owner}/${name}/actions/runs?head_sha=${encodeURIComponent(
      input.headSha
    )}&per_page=20`
  );
  return result.workflow_runs;
}

export async function getWorkflowJobs(input: {
  repo: string;
  runId: number;
}): Promise<
  Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    html_url: string;
    failedStep: string | null;
  }>
> {
  const { owner, name } = parseRepo(input.repo);
  const result = await githubFetch<{
    jobs: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
      steps?: Array<{ name: string; conclusion: string | null }>;
    }>;
  }>(input.repo, `/repos/${owner}/${name}/actions/runs/${input.runId}/jobs?per_page=100`);

  return result.jobs.map((job) => ({
    id: job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
    html_url: job.html_url,
    failedStep: job.steps?.find((s) => s.conclusion === "failure")?.name ?? null,
  }));
}
