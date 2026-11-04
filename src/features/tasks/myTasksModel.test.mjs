import assert from "node:assert/strict";
import test from "node:test";
import { groupTasksByObject, groupMyTasks } from "./myTasksModel.ts";

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
