import assert from "node:assert/strict";
import test from "node:test";

process.env.TELEGRAM_BOT_TOKEN ||= "test-token";
process.env.ALLOWED_TELEGRAM_USER_IDS ||= "1";
process.env.OPENAI_API_KEY ||= "test-key";
process.env.INTERNAL_API_SECRET ||= "test-secret";

test("executeOpsPlan rejects docker_ps when docker ops disabled", async () => {
  const { executeOpsPlan } = await import("./opsExecutor.js");

  await assert.rejects(
    () => executeOpsPlan({ action: "docker_ps" }),
    /Docker ops 未啟用/
  );
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
