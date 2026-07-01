import assert from "node:assert/strict";
import test from "node:test";
import { resolveAllowedRepo } from "../utils/githubRepo.js";

test("resolveAllowedRepo matches explicit owner/repo", () => {
  const repo = resolveAllowedRepo(
    "幫我看 Aiden4939/telegram-agent-bot 的 issues",
    ["Aiden4939/telegram-agent-bot", "Aiden4939/line-reminder-bot"]
  );
  assert.equal(repo, "Aiden4939/telegram-agent-bot");
});

test("resolveAllowedRepo matches repo name when unique", () => {
  const repo = resolveAllowedRepo("telegram-agent-bot 的 open issues", [
    "Aiden4939/telegram-agent-bot",
    "Aiden4939/line-reminder-bot",
  ]);
  assert.equal(repo, "Aiden4939/telegram-agent-bot");
});

test("resolveAllowedRepo uses single allowlist entry as default", () => {
  const repo = resolveAllowedRepo("有哪些 issue", ["Aiden4939/telegram-agent-bot"]);
  assert.equal(repo, "Aiden4939/telegram-agent-bot");
});

test("resolveAllowedRepo avoids short-name substring false positives", () => {
  const repo = resolveAllowedRepo("telegram-agent-bot 的 open issues", [
    "Aiden4939/bot",
    "Aiden4939/line-reminder-bot",
  ]);
  assert.equal(repo, null);
});

test("resolveAllowedRepo does not default when another repo is mentioned", () => {
  const repo = resolveAllowedRepo("line-reminder-bot 有哪些 issue", [
    "Aiden4939/telegram-agent-bot",
  ]);
  assert.equal(repo, null);
});
