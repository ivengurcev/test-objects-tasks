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
