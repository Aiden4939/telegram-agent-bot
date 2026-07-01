import assert from "node:assert/strict";
import test from "node:test";

process.env.TELEGRAM_BOT_TOKEN ||= "test-token";
process.env.ALLOWED_TELEGRAM_USER_IDS ||= "1";
process.env.OPENAI_API_KEY ||= "test-key";
process.env.INTERNAL_API_SECRET ||= "test-secret";

test("assertProductionRuntimeGuards exits when webhook uses local dev runtime", async () => {
  process.env.TELEGRAM_MODE = "webhook";
  process.env.DEV_RUNTIME = "local";

  const originalExit = process.exit;
  let exitCode: number | undefined;
  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new Error("process.exit called");
  }) as typeof process.exit;

  try {
    const { assertProductionRuntimeGuards } = await import("../config/validateEnv.js");
    assert.throws(() => assertProductionRuntimeGuards(), /process.exit called/);
    assert.equal(exitCode, 1);
  } finally {
    process.exit = originalExit;
    delete process.env.TELEGRAM_MODE;
    delete process.env.DEV_RUNTIME;
  }
});

test("assertProductionRuntimeGuards allows polling with local runtime", async () => {
  process.env.TELEGRAM_MODE = "polling";
  process.env.DEV_RUNTIME = "local";

  const { assertProductionRuntimeGuards } = await import("../config/validateEnv.js");
  assert.doesNotThrow(() => assertProductionRuntimeGuards());

  delete process.env.TELEGRAM_MODE;
  delete process.env.DEV_RUNTIME;
});

test("assertProductionRuntimeGuards exits when webhook cloud has no CLOUD_REPOS", async () => {
  process.env.TELEGRAM_MODE = "webhook";
  process.env.DEV_RUNTIME = "cloud";
  delete process.env.CLOUD_REPOS;

  const originalExit = process.exit;
  let exitCode: number | undefined;
  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new Error("process.exit called");
  }) as typeof process.exit;

  try {
    const { assertProductionRuntimeGuards } = await import("../config/validateEnv.js");
    assert.throws(() => assertProductionRuntimeGuards(), /process.exit called/);
    assert.equal(exitCode, 1);
  } finally {
    process.exit = originalExit;
    delete process.env.TELEGRAM_MODE;
    delete process.env.DEV_RUNTIME;
  }
});
