import assert from "node:assert/strict";
import test from "node:test";
import { redactSecrets } from "./redaction.js";

test("redactSecrets masks github token and bearer token", () => {
  const input = "token ghp_abcdefghijklmnopqrstuvwxyz and Authorization: Bearer abc.def.ghi";
  const output = redactSecrets(input);
  assert.match(output, /ghp_\*\*\*\*/);
  assert.match(output, /Authorization: \*\*\*\*/);
});

test("redactSecrets masks postgres password", () => {
  const input = "postgres://user:super-secret@db.internal:5432/appdb";
  const output = redactSecrets(input);
  assert.match(output, /postgres:\/\/user:\*\*\*\*@db\.internal/);
});
