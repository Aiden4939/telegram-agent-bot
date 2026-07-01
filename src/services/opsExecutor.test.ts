import assert from "node:assert/strict";
import test from "node:test";

process.env.TELEGRAM_BOT_TOKEN ||= "test-token";
process.env.ALLOWED_TELEGRAM_USER_IDS ||= "1";
process.env.OPENAI_API_KEY ||= "test-key";
process.env.INTERNAL_API_SECRET ||= "test-secret";
process.env.OPS_DOCKER_ENABLED = "false";

test("executeOpsPlan returns friendly message for docker_ps when docker ops disabled", async () => {
  const { executeOpsPlan } = await import("./opsExecutor.js");

  const result = await executeOpsPlan({ action: "docker_ps" });
  assert.equal(result.ok, false);
  assert.equal(result.action, "docker_ps");
  assert.match(result.detail, /Docker 主機查詢目前基於安全考量暫停使用/);
  assert.match(result.detail, /Health Check/);
});

test("executeOpsPlan returns friendly message for tail_logs when docker ops disabled", async () => {
  const { executeOpsPlan } = await import("./opsExecutor.js");

  const result = await executeOpsPlan({
    action: "tail_logs",
    container: "svc-telegram-bot",
  });
  assert.equal(result.ok, false);
  assert.equal(result.action, "tail_logs");
  assert.match(result.detail, /Docker 主機查詢目前基於安全考量暫停使用/);
});

test("executeOpsPlan still runs check_health when docker ops disabled", async () => {
  const { executeOpsPlan } = await import("./opsExecutor.js");

  const result = await executeOpsPlan({ action: "check_health" });
  assert.equal(result.action, "check_health");
  assert.match(result.detail, /health/);
});

test("executeOpsPlan disables disk_usage with host disk message", async () => {
  const { executeOpsPlan } = await import("./opsExecutor.js");

  const result = await executeOpsPlan({ action: "disk_usage" });
  assert.equal(result.ok, false);
  assert.equal(result.action, "disk_usage");
  assert.match(result.detail, /Host 磁碟查詢目前尚未提供安全的查詢通道/);
});

test("formatOpsResult includes action summary and detail", async () => {
  const { formatOpsResult } = await import("./opsExecutor.js");

  const text = formatOpsResult({
    ok: true,
    action: "check_health",
    summary: "健康檢查通過",
    detail: "http://127.0.0.1:3001/health → OK (200)",
    exitCode: 0,
  });

  assert.match(text, /ops check_health：成功/);
  assert.match(text, /健康檢查通過/);
  assert.match(text, /OK \(200\)/);
});
