import { supabase } from "../../lib/supabase";

export type CrmObject = {
  id: string;
  name: string;
  address: string;
};

export type ActiveTaskStatus = {
  object_id: string;
  status: string;
};

function client() {
  if (!supabase) throw new Error("Supabase не настроен.");
  return supabase;
}

export async function listObjects(): Promise<CrmObject[]> {
  const { data, error } = await client()
    .from("objects")
    .select("id, name, address")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data;
}

export async function listActiveTaskStatuses(): Promise<ActiveTaskStatus[]> {
  const { data, error } = await client()
    .from("tasks")
    .select("object_id, status")
    .is("deleted_at", null);
  if (error) throw error;
  return data;
}

export async function createObject(name: string, address: string): Promise<CrmObject> {
  const { data, error } = await client()
    .from("objects")
    .insert({ name, address })
    .select("id, name, address")
    .single();
  if (error) throw error;
  return data;
}

export async function updateObject(id: string, name: string, address: string): Promise<CrmObject> {
  const { data, error } = await client()
    .from("objects")
    .update({ name, address })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, name, address")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteObject(id: string): Promise<void> {
  const { error } = await client().rpc("delete_object", { p_object_id: id });
  if (error) throw error;
}
