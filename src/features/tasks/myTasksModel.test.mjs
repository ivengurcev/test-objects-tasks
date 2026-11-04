import assert from "node:assert/strict";
import test from "node:test";
import { groupTasksByObject, groupMyTasks, initialMyTasksState, myTasksReducer } from "./myTasksModel.ts";

test("groups assigned tasks under their objects and omits empty objects", () => {
  const groups = groupTasksByObject([
    { id: "t-2", title: "Монтаж", status: "in_progress", object_id: "o-1", object: { name: "Дом Б", address: "Лесная, 2" } },
    { id: "t-1", title: "Подготовка", status: "new", object_id: "o-1", object: { name: "Дом Б", address: "Лесная, 2" } },
    { id: "t-3", title: "Проверка", status: "in_review", object_id: "o-2", object: { name: "Дом А", address: "Полевая, 1" } },
    { id: "t-4", title: "Недоступная связь", status: "new", object_id: "o-3", object: null },
  ]);

  assert.deepEqual(groups.map(({ objectId, name, address, tasks }) => ({
    objectId,
    name,
    address,
    taskIds: tasks.map(({ id }) => id),
  })), [
    { objectId: "o-2", name: "Дом А", address: "Полевая, 1", taskIds: ["t-3"] },
    { objectId: "o-1", name: "Дом Б", address: "Лесная, 2", taskIds: ["t-2", "t-1"] },
  ]);
});

test("returns no groups for an empty assigned-task list", () => {
  assert.deepEqual(groupTasksByObject([]), []);
});


test("separates accepted tasks while preserving all four active statuses", () => {
  const object = { id: "o-1", name: "Дом", address: "Адрес" };
  const tasks = ["new", "in_progress", "in_review", "rework", "accepted"].map((status, i) => ({
    id: `t-${i}`, title: status, status, object_id: "o-1", object,
  }));
  const { activeGroups, acceptedGroups } = groupMyTasks(tasks);
  assert.deepEqual(activeGroups[0].tasks.map((task) => task.status), ["new", "in_progress", "in_review", "rework"]);
  assert.deepEqual(acceptedGroups[0].tasks.map((task) => task.status), ["accepted"]);
  assert.equal(tasks.length, 5);
});

test("keeps accepted-only objects available when there are no active tasks", () => {
  const { activeGroups, acceptedGroups } = groupMyTasks([
    { id: "a", title: "Принятая", status: "accepted", object_id: "o-1", object: { id: "o-1", name: "Дом", address: "Адрес" } },
    { id: "hidden", title: "Недоступный объект", status: "new", object_id: "o-2", object: null },
  ]);
  assert.deepEqual(activeGroups, []);
  assert.equal(acceptedGroups.length, 1);
  assert.equal(acceptedGroups[0].tasks.length, 1);
  assert.deepEqual(groupMyTasks([]), { activeGroups: [], acceptedGroups: [] });
});


const cachedTask = { id: "task", title: "Работа", status: "new", object_id: "o-1", object: { id: "o-1", name: "Дом", address: "Адрес" } };

test("distinguishes first load from background refresh with cached tasks", () => {
  assert.equal(initialMyTasksState.tasks, null);
  const requested = myTasksReducer(initialMyTasksState, { type: "request", requestId: 1 });
  const tasks = [cachedTask];
  const loaded = myTasksReducer(requested, { type: "success", requestId: 1, tasks });
  const refreshing = myTasksReducer(loaded, { type: "request", requestId: 2 });
  assert.equal(refreshing.tasks, tasks);
  assert.equal(refreshing.error, "");
});

test("background failure keeps even an empty successful result and retry replaces it", () => {
  const loaded = myTasksReducer({ ...initialMyTasksState, requestId: 1 }, { type: "success", requestId: 1, tasks: [] });
  const refreshing = myTasksReducer(loaded, { type: "request", requestId: 2 });
  const failed = myTasksReducer(refreshing, { type: "failure", requestId: 2, error: "Offline" });
  assert.deepEqual(failed.tasks, []);
  assert.equal(failed.error, "Offline");
  const retry = myTasksReducer(failed, { type: "request", requestId: 3 });
  assert.equal(retry.tasks, failed.tasks);
  assert.equal(retry.error, "");
  const recovered = myTasksReducer(retry, { type: "success", requestId: 3, tasks: [cachedTask] });
  assert.deepEqual(recovered.tasks, [cachedTask]);
});

test("ignores older successes and errors after a newer request", () => {
  const first = myTasksReducer(initialMyTasksState, { type: "request", requestId: 1 });
  const second = myTasksReducer(first, { type: "request", requestId: 2 });
  const fresh = myTasksReducer(second, { type: "success", requestId: 2, tasks: [cachedTask] });
  assert.equal(myTasksReducer(fresh, { type: "success", requestId: 1, tasks: [] }), fresh);
  assert.equal(myTasksReducer(fresh, { type: "failure", requestId: 1, error: "Stale failure" }), fresh);
});

test("optimistic status invalidates a pending read before server synchronization", () => {
  const loading = { tasks: [cachedTask], error: "", requestId: 1 };
  const changed = myTasksReducer(loading, { type: "status", requestId: 2, taskId: "task", status: "in_progress" });
  assert.equal(changed.tasks[0].status, "in_progress");
  assert.equal(cachedTask.status, "new");
  assert.equal(myTasksReducer(changed, { type: "success", requestId: 1, tasks: [cachedTask] }), changed);
  const synchronizing = myTasksReducer(changed, { type: "request", requestId: 3 });
  const synchronized = myTasksReducer(synchronizing, { type: "success", requestId: 3, tasks: [{ ...cachedTask, status: "in_progress", title: "С сервера" }] });
  assert.equal(synchronized.tasks[0].title, "С сервера");
  const uncached = myTasksReducer(initialMyTasksState, { type: "status", requestId: 1, taskId: "task", status: "in_progress" });
  assert.equal(uncached.tasks, null);
});
