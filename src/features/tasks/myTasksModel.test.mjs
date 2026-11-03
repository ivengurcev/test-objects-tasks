import assert from "node:assert/strict";
import test from "node:test";
import { groupTasksByObject } from "./myTasksModel.ts";

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
