import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowEmptyHistory } from "./historyView.ts";

test("does not show the empty state while history is loading or has an error", () => {
  assert.equal(shouldShowEmptyHistory(true, false, 0), false);
  assert.equal(shouldShowEmptyHistory(false, true, 0), false);
});

test("shows the empty state only after a successful empty history response", () => {
  assert.equal(shouldShowEmptyHistory(false, false, 0), true);
  assert.equal(shouldShowEmptyHistory(false, false, 1), false);
});
