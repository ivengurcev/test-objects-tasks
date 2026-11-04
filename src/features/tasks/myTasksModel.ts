import type { TaskStatus } from "./tasksApi";

export type MyTask = {
  id: string;
  title: string;
  status: TaskStatus;
  object_id: string;
  object: { id: string; name: string; address: string } | null;
};

export type MyTaskGroup = {
  objectId: string;
  name: string;
  address: string;
  tasks: MyTask[];
};

export function groupTasksByObject(tasks: MyTask[]): MyTaskGroup[] {
  const groups = new Map<string, MyTaskGroup>();

  for (const task of tasks) {
    if (!task.object) continue;
    const group = groups.get(task.object_id) ?? {
      objectId: task.object_id,
      name: task.object.name,
      address: task.object.address,
      tasks: [],
    };
    group.tasks.push(task);
    groups.set(task.object_id, group);
  }

  return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function groupMyTasks(tasks: MyTask[]) {
  return {
    activeGroups: groupTasksByObject(tasks.filter((task) => task.status !== "accepted")),
    acceptedGroups: groupTasksByObject(tasks.filter((task) => task.status === "accepted")),
  };
}
