import assert from "node:assert/strict";
import test from "node:test";

process.env.TELEGRAM_BOT_TOKEN ||= "test-token";
process.env.ALLOWED_TELEGRAM_USER_IDS ||= "1";
process.env.OPENAI_API_KEY ||= "test-key";
process.env.INTERNAL_API_SECRET ||= "test-secret";
process.env.GITHUB_TOKEN = "ghp_test_token";
process.env.GITHUB_ALLOWED_REPOS = "Aiden4939/telegram-agent-bot";

const originalFetch = globalThis.fetch;

test("executeGitHubPlan lists issues from GitHub API", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        {
          number: 4,
          title: "feat: github ops",
          state: "open",
          html_url: "https://github.com/Aiden4939/telegram-agent-bot/issues/4",
        },
      ]),
      { status: 200 }
    )) as typeof fetch;

  const { executeGitHubPlan } = await import("./githubExecutor.js");
  const result = await executeGitHubPlan({
    action: "list_issues",
    repo: "Aiden4939/telegram-agent-bot",
    state: "open",
  });

  assert.equal(result.ok, true);
  assert.match(result.detail, /#4 \[open\]/);

  globalThis.fetch = originalFetch;
});

test("executeGitHubPlan reports missing token", async () => {
  const saved = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;

  const { executeGitHubPlan } = await import("./githubExecutor.js");
  const result = await executeGitHubPlan({
    action: "list_issues",
    repo: "Aiden4939/telegram-agent-bot",
  });

  assert.equal(result.ok, false);
  assert.match(result.detail, /GITHUB_TOKEN/);

  process.env.GITHUB_TOKEN = saved;
});
