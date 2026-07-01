import assert from "node:assert/strict";
import test from "node:test";

process.env.TELEGRAM_BOT_TOKEN ||= "test-token";
process.env.ALLOWED_TELEGRAM_USER_IDS ||= "1";
process.env.OPENAI_API_KEY ||= "test-key";
process.env.INTERNAL_API_SECRET ||= "test-secret";
process.env.GITHUB_TOKEN ||= "ghp_testtoken";
process.env.GITHUB_ALLOWED_REPOS ||= "Aiden4939/telegram-agent-bot";

test("createOrReuseDraftPr rejects protected head branch", async () => {
  const { createOrReuseDraftPr } = await import("./githubWorkflowClient.js");
  await assert.rejects(
    () =>
      createOrReuseDraftPr({
        repo: "Aiden4939/telegram-agent-bot",
        baseBranch: "main",
        headBranch: "main",
        title: "x",
        body: "x",
      }),
    /invalid_head_branch/
  );
});

test("createOrReuseDraftPr reuses existing PR", async () => {
  const originalFetch = global.fetch;
  global.fetch = (async (url: string) => {
    if (url.includes("/pulls?")) {
      return new Response(
        JSON.stringify([{ number: 12, html_url: "https://github.com/pr/12", draft: true, head: { sha: "abc" } }]),
        { status: 200 }
      );
    }
    throw new Error("unexpected");
  }) as typeof fetch;
  try {
    const { createOrReuseDraftPr } = await import("./githubWorkflowClient.js");
    const pr = await createOrReuseDraftPr({
      repo: "Aiden4939/telegram-agent-bot",
      baseBranch: "main",
      headBranch: "agent/test",
      title: "title",
      body: "body",
    });
    assert.equal(pr.reused, true);
    assert.equal(pr.number, 12);
  } finally {
    global.fetch = originalFetch;
  }
});
