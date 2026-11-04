import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

// This script creates and removes only its own fixtures in the local Supabase stack.
const config = JSON.parse(execFileSync("yarn", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const url = new URL(config.API_URL);
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "API checks must use local Supabase");
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url.href, config.SERVICE_ROLE_KEY, options);
const users = [];
let objectId;
const taskIds = [];

function result(response, label) {
  if (response.error) throw new Error(`${label}: ${response.error.code ?? "request failed"}`);
  return response.data;
}

function denied(response, label) {
  assert.equal(response.error?.code, "42501", label);
}

async function createUser(role, name) {
  const email = `crm-api-${randomUUID()}@example.invalid`;
  const password = randomUUID();
  const { user } = result(await admin.auth.admin.createUser({ email, password, email_confirm: true }), "create local user");
  users.push(user.id);
  result(await admin.from("profiles").insert({ id: user.id, role, display_name: name }), "create local profile");
  // Local email sign-in is disabled; issue a local authenticated JWT without changing Auth configuration.
  const encoded = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const tokenBody = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({ sub: user.id, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 600 })}`;
  const token = `${tokenBody}.${createHmac("sha256", config.JWT_SECRET).update(tokenBody).digest("base64url")}`;
  const client = createClient(url.href, config.PUBLISHABLE_KEY ?? config.ANON_KEY, {
    ...options, global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { id: user.id, client };
}

try {
  const manager = await createUser("manager", "API Manager");
  const executors = [await createUser("executor", "API Executor 1"), await createUser("executor", "API Executor 2")];
  objectId = result(await manager.client.from("objects").insert({ name: "Local executor API check", address: "Local fixtures" }).select("id").single(), "manager creates object").id;
  for (let i = 0; i < executors.length; i++) {
    taskIds.push(result(await manager.client.rpc("create_task", { p_object_id: objectId, p_title: `API Task ${i + 1}`, p_description: "Local test", p_assignee_id: executors[i].id }), "manager creates task"));
  }
  assert.equal(result(await manager.client.from("tasks").select("id").in("id", taskIds), "manager reads both tasks").length, 2);

  for (let i = 0; i < executors.length; i++) {
    const { client, id } = executors[i];
    const ownTask = taskIds[i];
    const foreignTask = taskIds[1 - i];
    const visible = result(await client.from("tasks").select("id, assignee_id").in("id", taskIds), "executor reads tasks without assignee filter");
    assert.deepEqual(visible, [{ id: ownTask, assignee_id: id }], "RLS filters tasks even without a client assignee condition");
    assert.equal(result(await client.from("tasks").select("id").eq("id", foreignTask).maybeSingle(), "read foreign task"), null);
    assert.deepEqual(result(await client.from("task_status_history").select("id").eq("task_id", foreignTask), "read foreign history"), []);
    assert.deepEqual(result(await client.from("tasks").update({ title: "Forbidden edit" }).eq("id", foreignTask).select("id"), "foreign task update"), []);
    assert.deepEqual(result(await client.from("tasks").update({ title: "Forbidden own edit" }).eq("id", ownTask).select("id"), "direct own task update"), []);
    denied(await client.rpc("transition_task_status", { p_task_id: foreignTask, p_new_status: "in_progress", p_comment: null }), "cannot transition foreign task");
    assert.equal((await client.rpc("transition_task_status", { p_task_id: ownTask, p_new_status: "accepted", p_comment: null })).error?.code, "22023", "cannot skip to accepted");
    denied(await client.from("tasks").update({ status: "accepted" }).eq("id", ownTask), "cannot directly update status");
    denied(await client.rpc("delete_task", { p_task_id: ownTask }), "cannot logically delete task");
    denied(await client.from("tasks").delete().eq("id", foreignTask), "cannot physically delete foreign task");
    denied(await client.from("task_status_history").update({ comment: "Forged" }).eq("task_id", ownTask), "cannot edit history");
    denied(await client.from("task_status_history").delete().eq("task_id", ownTask), "cannot delete history");
    denied(await client.from("task_status_history").insert({ task_id: ownTask, actor_id: id, to_status: "accepted" }), "cannot forge history");

    result(await client.rpc("transition_task_status", { p_task_id: ownTask, p_new_status: "in_progress", p_comment: null }), "executor starts work");
    result(await client.rpc("transition_task_status", { p_task_id: ownTask, p_new_status: "in_review", p_comment: null }), "executor submits review");
    assert.equal((await manager.client.rpc("transition_task_status", { p_task_id: ownTask, p_new_status: "rework", p_comment: "   " })).error?.code, "22023", "server requires rework comment");
    result(await manager.client.rpc("transition_task_status", { p_task_id: ownTask, p_new_status: "rework", p_comment: "Correct the local test work" }), "manager returns for rework");
    result(await client.rpc("transition_task_status", { p_task_id: ownTask, p_new_status: "in_progress", p_comment: null }), "executor resumes rework");
    result(await client.rpc("transition_task_status", { p_task_id: ownTask, p_new_status: "in_review", p_comment: null }), "executor resubmits review");
    result(await manager.client.rpc("transition_task_status", { p_task_id: ownTask, p_new_status: "accepted", p_comment: null }), "manager accepts task");
    const history = result(await client.from("task_status_history").select("to_status, comment").eq("task_id", ownTask).order("created_at").order("id"), "read own history");
    assert.deepEqual(history.map((event) => event.to_status), ["new", "in_progress", "in_review", "rework", "in_progress", "in_review", "accepted"]);
    assert.equal(history[3].comment, "Correct the local test work");
    const own = result(await client.from("tasks").select("title, status").eq("id", ownTask).single(), "read accepted task");
    assert.equal(own.title, `API Task ${i + 1}`);
    assert.equal(own.status, "accepted");
    console.log(`PASS Executor ${i + 1}: direct API isolation, forbidden writes/history/transitions and full allowed cycle`);
  }
  console.log("PASS Manager and both executors checked using authenticated JWTs scoped to each local user");
} finally {
  if (objectId) {
    const tasks = result(await admin.from("tasks").select("id").eq("object_id", objectId), "find local fixtures for cleanup");
    const ids = tasks.map((task) => task.id);
    if (ids.length) {
      result(await admin.from("task_status_history").delete().in("task_id", ids), "remove local history fixtures");
      result(await admin.from("tasks").delete().in("id", ids), "remove local task fixtures");
    }
    result(await admin.from("objects").delete().eq("id", objectId), "remove local object fixture");
  }
  for (const id of users) result(await admin.auth.admin.deleteUser(id), "remove local test user");
  console.log("Local API fixtures removed");
}
