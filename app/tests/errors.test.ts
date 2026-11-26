// Program errors shown to students in plain words, from simulation logs.
import { test } from "node:test";
import assert from "node:assert/strict";

const { friendlyError } = await import("../src/lib/errors.ts");

function simError(logs: string[]) {
  return Object.assign(new Error('{"InstructionError":[0,{"Custom":6007}]}'), { logs });
}

test("a known program error becomes a plain sentence", () => {
  const e = simError([
    "Program log: AnchorError occurred. Error Code: PayByPassed. Error Number: 6007. Error Message: The pay-by time has passed.",
  ]);
  assert.equal(friendlyError(e), "The pay-by time has passed.");
});

test("an unmapped Anchor error still shows its own message", () => {
  const e = simError(["Program log: AnchorError caused by account: x. Error Code: Weird. Error Message: Something specific broke."]);
  assert.equal(friendlyError(e), "Something specific broke.");
});

test("a cancelled wallet prompt is explained", () => {
  assert.equal(friendlyError(new Error("User rejected the request.")), "You cancelled the request in your wallet.");
});
