import { supabase } from "../../lib/supabase";

export type TaskStatus = "new" | "in_progress" | "in_review" | "accepted" | "rework";

export type TaskAssignee = {
  id: string;
  display_name: string;
};

export type CrmTask = {
  id: string;
  title: string;
  description: string;
  object_id: string;
  assignee_id: string;
  status: TaskStatus;
  assignee: TaskAssignee | null;
};

export type TaskDetailsData = CrmTask & {
  created_at: string;
  object: { name: string; address: string } | null;
  author: { display_name: string } | null;
};

export type TaskStatusEvent = {
  id: string;
  actor_id: string;
  to_status: TaskStatus;
  comment: string | null;
  created_at: string;
  actor: { display_name: string } | null;
};

export type ExecutorProfile = TaskAssignee;

function client() {
  if (!supabase) throw new Error("Supabase не настроен.");
  return supabase;
}

const taskSelection = "id, title, description, object_id, assignee_id, status, assignee:profiles!tasks_assignee_id_fkey(id, display_name)";

export async function listTasks(objectId: string): Promise<CrmTask[]> {
  const { data, error } = await client()
    .from("tasks")
    .select(taskSelection)
    .eq("object_id", objectId)
    .is("deleted_at", null)
    .order("title");
  if (error) throw error;
  return data as unknown as CrmTask[];
}

export async function listExecutors(): Promise<ExecutorProfile[]> {
  const { data, error } = await client()
    .from("profiles")
    .select("id, display_name")
    .eq("role", "executor")
    .order("display_name");
  if (error) throw error;
  return data;
}

export async function getTaskDetails(taskId: string): Promise<TaskDetailsData> {
  const { data, error } = await client()
    .from("tasks")
    .select("id, title, description, object_id, assignee_id, status, created_at, assignee:profiles!tasks_assignee_id_fkey(id, display_name), author:profiles!tasks_author_id_fkey(display_name), object:objects!tasks_object_id_fkey(name, address)")
    .eq("id", taskId)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  return data as unknown as TaskDetailsData;
}

export async function listTaskHistory(taskId: string): Promise<TaskStatusEvent[]> {
  const { data, error } = await client()
    .from("task_status_history")
    .select("id, actor_id, to_status, comment, created_at, actor:profiles!task_status_history_actor_id_fkey(display_name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return data as unknown as TaskStatusEvent[];
}

export async function createTask(objectId: string, title: string, description: string, assigneeId: string): Promise<void> {
  const { error } = await client().rpc("create_task", {
    p_object_id: objectId,
    p_title: title,
    p_description: description,
    p_assignee_id: assigneeId,
  });
  if (error) throw error;
}

export async function updateTask(id: string, title: string, description: string, assigneeId: string): Promise<void> {
  const { error } = await client()
    .from("tasks")
    .update({ title, description, assignee_id: assigneeId })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await client().rpc("delete_task", { p_task_id: id });
  if (error) throw error;
}

export async function transitionTaskStatus(taskId: string, status: TaskStatus, comment: string | null): Promise<void> {
  const { error } = await client().rpc("transition_task_status", {
    p_task_id: taskId,
    p_new_status: status,
    p_comment: comment,
  });
  if (error) throw error;
}
