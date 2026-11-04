import assert from "node:assert/strict";
import test from "node:test";
import { parseRoute, routeDepth, getPathForRole } from "./routes.ts";

test("restores object and nested task screens from a direct URL", () => {
  assert.deepEqual(parseRoute("/objects/site-1"), { kind: "object", objectId: "site-1" });
  assert.deepEqual(parseRoute("/objects/site-1/tasks/task-2/"), { kind: "task", objectId: "site-1", taskId: "task-2" });
  assert.deepEqual(parseRoute("/my-tasks/task-2"), { kind: "my-task", taskId: "task-2" });
});

test("recognizes entry screens and rejects unrelated or incomplete URLs", () => {
  assert.deepEqual(parseRoute("/"), { kind: "home" });
  assert.deepEqual(parseRoute("/objects"), { kind: "objects" });
  assert.deepEqual(parseRoute("/my-tasks"), { kind: "my-tasks" });
  for (const path of ["/unknown", "/objects/a/tasks", "/objects/a/tasks/b/extra"]) {
    assert.deepEqual(parseRoute(path), { kind: "not-found" });
  }
});

test("parent screens have a lower depth for reverse transitions", () => {
  assert.ok(routeDepth("/objects") < routeDepth("/objects/a"));
  assert.ok(routeDepth("/objects/a") < routeDepth("/objects/a/tasks/b"));
  assert.ok(routeDepth("/my-tasks") < routeDepth("/my-tasks/b"));
});


test("restores each role home when the previous account left another role URL", () => {
  assert.equal(getPathForRole("executor", "/objects"), "/my-tasks");
  assert.equal(getPathForRole("executor", "/objects/site-1"), "/my-tasks");
  assert.equal(getPathForRole("executor", "/"), "/my-tasks");
  assert.equal(getPathForRole("manager", "/my-tasks"), "/objects");
  assert.equal(getPathForRole("manager", "/my-tasks/task-2"), "/objects");
  assert.equal(getPathForRole("manager", "/"), "/objects");
});

test("preserves valid direct task URLs and translates executor legacy links", () => {
  assert.equal(getPathForRole("executor", "/objects/site-1/tasks/task-2"), "/my-tasks/task-2");
  assert.equal(getPathForRole("executor", "/my-tasks/task-2"), "/my-tasks/task-2");
  assert.equal(getPathForRole("executor", "/my-tasks"), "/my-tasks");
  assert.equal(getPathForRole("manager", "/objects/site-1/tasks/task-2"), "/objects/site-1/tasks/task-2");
  assert.equal(getPathForRole("manager", "/objects/site-1"), "/objects/site-1");
  assert.equal(getPathForRole("executor", "/unknown"), "/unknown");
});
