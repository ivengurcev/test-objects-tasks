import assert from "node:assert/strict";
import test from "node:test";
import { reworkCommentError } from "./formValidation.ts";

test("rejects an empty or whitespace-only rework comment", () => {
  assert.equal(reworkCommentError(""), "Укажите комментарий для возврата задачи на доработку.");
  assert.equal(reworkCommentError("  \n\t "), "Укажите комментарий для возврата задачи на доработку.");
});

test("accepts a non-empty rework comment", () => {
  assert.equal(reworkCommentError(" Нужно исправить монтаж. "), null);
});
