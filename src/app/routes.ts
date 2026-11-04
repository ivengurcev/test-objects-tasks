export type Route =
  | { kind: "home" | "objects" | "my-tasks" | "not-found" }
  | { kind: "object"; objectId: string }
  | { kind: "task"; objectId: string; taskId: string }
  | { kind: "my-task"; taskId: string };

export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/") return { kind: "home" };
  if (path === "/objects") return { kind: "objects" };
  if (path === "/my-tasks") return { kind: "my-tasks" };
  const task = path.match(/^\/objects\/([^/]+)\/tasks\/([^/]+)$/);
  if (task) return { kind: "task", objectId: task[1], taskId: task[2] };
  const object = path.match(/^\/objects\/([^/]+)$/);
  if (object) return { kind: "object", objectId: object[1] };
  const myTask = path.match(/^\/my-tasks\/([^/]+)$/);
  if (myTask) return { kind: "my-task", taskId: myTask[1] };
  return { kind: "not-found" };
}

export function routeDepth(pathname: string): number {
  const route = parseRoute(pathname);
  return route.kind === "task" ? 2 : route.kind === "object" || route.kind === "my-task" ? 1 : 0;
}

export function getPathForRole(role: "manager" | "executor", pathname: string): string {
  const route = parseRoute(pathname);
  if (route.kind === "home") return role === "manager" ? "/objects" : "/my-tasks";
  if (role === "executor") {
    if (route.kind === "task") return `/my-tasks/${route.taskId}`;
    if (route.kind === "objects" || route.kind === "object") return "/my-tasks";
  } else if (route.kind === "my-tasks" || route.kind === "my-task") return "/objects";
  return pathname;
}
