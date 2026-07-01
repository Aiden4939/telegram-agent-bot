import assert from "node:assert/strict";
import test from "node:test";

process.env.TELEGRAM_BOT_TOKEN ||= "test-token";
process.env.ALLOWED_TELEGRAM_USER_IDS ||= "1";
process.env.OPENAI_API_KEY ||= "test-key";
process.env.INTERNAL_API_SECRET ||= "test-secret";
process.env.GITHUB_ALLOWED_REPOS = "Aiden4939/telegram-agent-bot";

test("planGitHubActionByRules maps issue questions to list_issues", async () => {
  const { planGitHubActionByRules } = await import("./githubPlanner.js");

  const plan = planGitHubActionByRules(
    "幫我看 telegram-agent-bot 的 github issue 有什麼"
  );
  assert.equal(plan.action, "list_issues");
  assert.equal(plan.repo, "Aiden4939/telegram-agent-bot");
  assert.equal(plan.state, "open");
});

test("planGitHubActionByRules maps pr questions to list_prs", async () => {
  const { planGitHubActionByRules } = await import("./githubPlanner.js");

  const plan = planGitHubActionByRules("列出 telegram-agent-bot 最近 PR");
  assert.equal(plan.action, "list_prs");
});

test("planGitHubActionByRules ignores closed substring in unrelated words", async () => {
  const { planGitHubActionByRules } = await import("./githubPlanner.js");

  const plan = planGitHubActionByRules(
    "actually install github issues for telegram-agent-bot"
  );
  assert.equal(plan.state, "open");
});

test("planGitHubActionByRules recognizes Closed state case-insensitively", async () => {
  const { planGitHubActionByRules } = await import("./githubPlanner.js");

  const plan = planGitHubActionByRules(
    "列出 telegram-agent-bot 的 Closed issues"
  );
  assert.equal(plan.state, "closed");
});
