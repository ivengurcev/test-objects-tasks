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

type MyTasksState = { tasks: MyTask[] | null; error: string; requestId: number };
type MyTasksUpdate =
  | { type: "request"; requestId: number }
  | { type: "success"; requestId: number; tasks: MyTask[] }
  | { type: "failure"; requestId: number; error: string }
  | { type: "status"; requestId: number; taskId: string; status: TaskStatus };

export const initialMyTasksState: MyTasksState = { tasks: null, error: "", requestId: 0 };

export function myTasksReducer(state: MyTasksState, update: MyTasksUpdate): MyTasksState {
  if (update.type === "request") return { ...state, error: "", requestId: update.requestId };
  if (update.type === "status") return {
    ...state,
    requestId: update.requestId,
    tasks: state.tasks?.map((task) => task.id === update.taskId ? { ...task, status: update.status } : task) ?? null,
  };
  if (update.requestId !== state.requestId) return state;
  if (update.type === "success") return { ...state, tasks: update.tasks, error: "" };
  return { ...state, error: update.error };
}
