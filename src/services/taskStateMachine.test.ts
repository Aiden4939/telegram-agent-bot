import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTaskStatusTransition,
  canTransitionTaskStatus,
} from "./taskStateMachine.js";

test("task state machine allows legal transition", () => {
  assert.equal(canTransitionTaskStatus("RECEIVED", "CLASSIFIED"), true);
  assert.doesNotThrow(() => assertTaskStatusTransition("RUNNING", "CHECKPOINTED"));
});

test("task state machine rejects illegal transition", () => {
  assert.equal(canTransitionTaskStatus("RECEIVED", "COMPLETED"), false);
  assert.throws(() => assertTaskStatusTransition("FAILED", "RUNNING"));
});
