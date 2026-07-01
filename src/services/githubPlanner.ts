import { openai } from "./openaiClient.js";
import { env } from "../config/env.js";
import {
  GITHUB_ACTIONS,
  type GitHubAction,
  type GitHubIssueState,
  type GitHubPlan,
} from "../types/github.js";
import { resolveAllowedRepo } from "../utils/githubRepo.js";

const VALID_ACTIONS = new Set<string>([...GITHUB_ACTIONS]);

function parseGitHubPlanJson(raw: string): GitHubPlan | null {
  try {
    const parsed = JSON.parse(raw) as {
      action?: string;
      repo?: string;
      state?: string;
    };

    if (!parsed.action || !VALID_ACTIONS.has(parsed.action)) {
      return null;
    }

    const state = parsed.state?.trim() as GitHubIssueState | undefined;
    if (state && !["open", "closed", "all"].includes(state)) {
      return null;
    }

    return {
      action: parsed.action as GitHubAction,
      repo: parsed.repo?.trim() || undefined,
      state,
    };
  } catch {
    return null;
  }
}

function inferIssueState(text: string): GitHubIssueState {
  const lower = text.toLowerCase();
  if (/\bclosed\b|關閉|已關/.test(lower)) {
    return "closed";
  }
  if (/\ball\b|全部/.test(lower)) {
    return "all";
  }
  return "open";
}

export function planGitHubActionByRules(text: string): GitHubPlan {
  const lower = text.toLowerCase();

  if (/pull request|\bpr\b|合併請求/.test(lower)) {
    return {
      action: "list_prs",
      repo: resolveAllowedRepo(text, env.githubAllowedRepos) ?? undefined,
      state: inferIssueState(text),
    };
  }

  if (/issue|issues|議題|開卡|github/.test(lower)) {
    return {
      action: "list_issues",
      repo: resolveAllowedRepo(text, env.githubAllowedRepos) ?? undefined,
      state: inferIssueState(text),
    };
  }

  return { action: "unknown" };
}

export async function planGitHubAction(text: string): Promise<GitHubPlan> {
  try {
    const completion = await openai.chat.completions.create({
      model: env.llmModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "你是 GitHub 查詢規劃器。分析使用者訊息，只回傳 JSON：",
            '{"action":"list_issues|list_prs|unknown","repo":"可選 owner/repo","state":"open|closed|all"}',
            "",
            "規則：",
            "- list_issues：查詢 GitHub issues 列表",
            "- list_prs：查詢 Pull Request 列表",
            "- repo：若使用者提到 repo 名稱，填允許清單內的 owner/repo",
            "- state：預設 open",
            "- unknown：無法判斷",
          ].join("\n"),
        },
        { role: "user", content: text },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("LLM github plan empty");
    }

    const parsed = parseGitHubPlanJson(content);
    if (!parsed) {
      throw new Error("LLM github plan invalid");
    }

    if (!parsed.repo) {
      parsed.repo = resolveAllowedRepo(text, env.githubAllowedRepos) ?? undefined;
    }

    if (!parsed.state) {
      parsed.state = inferIssueState(text);
    }

    return parsed;
  } catch (error) {
    console.warn("[github] LLM planning failed, fallback to rules:", error);
    return planGitHubActionByRules(text);
  }
}
