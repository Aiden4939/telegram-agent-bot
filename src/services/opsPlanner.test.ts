import assert from "node:assert/strict";
import test from "node:test";

process.env.TELEGRAM_BOT_TOKEN ||= "test-token";
process.env.ALLOWED_TELEGRAM_USER_IDS ||= "1";
process.env.OPENAI_API_KEY ||= "test-key";
process.env.INTERNAL_API_SECRET ||= "test-secret";

test("planOpsActionByRules prefers check_health for docker health questions", async () => {
  const { planOpsActionByRules } = await import("./opsPlanner.js");

  const plan = planOpsActionByRules("幫我看現在 docker 服務是否健康");
  assert.equal(plan.action, "check_health");
});

test("planOpsActionByRules maps docker status to docker_ps", async () => {
  const { planOpsActionByRules } = await import("./opsPlanner.js");

  const plan = planOpsActionByRules("幫我看 docker 容器狀態");
  assert.equal(plan.action, "docker_ps");
});

test("planOpsActionByRules maps log requests to tail_logs", async () => {
  const { planOpsActionByRules } = await import("./opsPlanner.js");

  const plan = planOpsActionByRules("幫我看 telegram-agent-bot 最近 log");
  assert.equal(plan.action, "tail_logs");
  assert.equal(plan.container, "telegram-agent-bot");
});

test("planOpsActionByRules maps disk questions to disk_usage", async () => {
  const { planOpsActionByRules } = await import("./opsPlanner.js");

  const plan = planOpsActionByRules("幫我看磁碟使用");
  assert.equal(plan.action, "disk_usage");
});
