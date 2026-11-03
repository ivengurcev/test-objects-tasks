import { createClient } from "@supabase/supabase-js";

const requiredVariables = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "CRM_MANAGER_EMAIL",
  "CRM_MANAGER_PASSWORD",
  "CRM_EXECUTOR_1_EMAIL",
  "CRM_EXECUTOR_1_PASSWORD",
  "CRM_EXECUTOR_2_EMAIL",
  "CRM_EXECUTOR_2_PASSWORD",
];

let failures = 0;

function report(name, passed, detail = "") {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures += 1;
}

function errorCode(error) {
  return typeof error?.code === "string" && /^[A-Z0-9_-]+$/.test(error.code)
    ? `Supabase ${error.code}`
    : "request failed";
}

function createUserClient(url, key) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function signIn(label, email, password, url, key) {
  const client = createUserClient(url, key);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    report(`${label} Auth sign-in`, false, errorCode(error));
    return null;
  }

  report(`${label} Auth sign-in`, true);
  return { client, userId: data.user.id };
}

async function readProfile(label, user) {
  const { data, error } = await user.client
    .from("profiles")
    .select("id, role")
    .eq("id", user.userId)
    .maybeSingle();

  const role = label === "Manager" ? "manager" : "executor";
  const passed = !error && data?.id === user.userId && data.role === role;
  report(`${label} profile has expected role`, passed, error ? errorCode(error) : "");
  return passed ? data : null;
}

async function readActiveObjects(user, label) {
  const { data, count, error } = await user.client
    .from("objects")
    .select("id, deleted_at", { count: "exact" })
    .is("deleted_at", null);

  if (error) {
    report(`${label} reads active objects`, false, errorCode(error));
    return null;
  }

  const passed = count === data.length && data.every((object) => object.deleted_at === null);
  report(`${label} reads active objects`, passed);
  return data;
}

async function readActiveTasks(user, label) {
  const { data, count, error } = await user.client
    .from("tasks")
    .select("id, assignee_id, object_id, status, author_id, deleted_at", { count: "exact" })
    .is("deleted_at", null);

  if (error) {
    report(`${label} reads active tasks`, false, errorCode(error));
    return null;
  }

  const passed = count === data.length && data.every((task) => task.deleted_at === null);
  report(`${label} reads active tasks`, passed);
  return data;
}

async function checkNoTaskAccess(user, label, taskId) {
  const { data, error } = await user.client
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .maybeSingle();

  report(`${label} cannot read another executor's task`, !error && data === null, error ? errorCode(error) : "");
}

async function checkNoHistoryAccess(user, label, taskId) {
  const { data, error } = await user.client
    .from("task_status_history")
    .select("id")
    .eq("task_id", taskId);

  report(`${label} cannot read another executor's history`, !error && data.length === 0, error ? errorCode(error) : "");
}

async function checkExecutorReadsRelatedProfiles(user, label, task, managerClient) {
  const { data: events, error: historyError } = await managerClient
    .from("task_status_history")
    .select("actor_id")
    .eq("task_id", task.id);

  if (historyError || !events?.length) {
    report(`${label} reads author and history participant profiles`, false, historyError ? errorCode(historyError) : "no task history available");
    return new Set();
  }

  const participantIds = [...new Set(events.map((event) => event.actor_id))];
  const expectedIds = [...new Set([task.author_id, ...participantIds])];
  const { data: visibleProfiles, error } = await user.client
    .from("profiles")
    .select("id, role")
    .in("id", expectedIds);

  const visibleIds = new Set((visibleProfiles ?? []).map((profile) => profile.id));
  const passed = !error && expectedIds.every((id) => visibleIds.has(id));
  report(`${label} reads author and history participant profiles`, passed, error ? errorCode(error) : "");
  return new Set(expectedIds);
}

async function checkUnrelatedProfileHidden(user, label, excludedIds, profiles, otherExecutorId) {
  const unrelated = profiles.find((profile) =>
    profile.id === otherExecutorId && !excludedIds.has(profile.id))
    ?? profiles.find((profile) => !excludedIds.has(profile.id));

  if (!unrelated) {
    report(`${label} cannot read an unrelated profile`, false, "no unrelated profile available for this task");
    return;
  }

  const { data, error } = await user.client
    .from("profiles")
    .select("id")
    .eq("id", unrelated.id)
    .maybeSingle();

  report(`${label} cannot read an unrelated profile`, !error && data === null, error ? errorCode(error) : "");
}

async function checkExecutor(label, user, otherUser, managerTasks, managerProfiles) {
  const tasks = await readActiveTasks(user, label);
  const objects = await readActiveObjects(user, label);
  if (!tasks || !objects) return;

  const ownTasks = tasks.filter((task) => task.assignee_id === user.userId);
  const onlyOwnTasks = tasks.every((task) => task.assignee_id === user.userId && task.deleted_at === null);
  report(`${label} sees only their assigned active tasks`, onlyOwnTasks);

  const expectedObjectIds = new Set(ownTasks.map((task) => task.object_id));
  const visibleObjectIds = new Set(objects.map((object) => object.id));
  const objectScopeIsCorrect = objects.every((object) => object.deleted_at === null && expectedObjectIds.has(object.id))
    && [...expectedObjectIds].every((id) => visibleObjectIds.has(id));
  report(`${label} sees only objects linked to their tasks`, objectScopeIsCorrect);

  const foreignTask = managerTasks?.find((task) => task.assignee_id === otherUser.userId);
  if (foreignTask) {
    await checkNoTaskAccess(user, label, foreignTask.id);
    await checkNoHistoryAccess(user, label, foreignTask.id);
  } else {
    report(`${label} cannot read another executor's task`, false, "no task assigned to the other executor");
    report(`${label} cannot read another executor's history`, false, "no task assigned to the other executor");
  }

  const ownTask = ownTasks[0];
  if (!ownTask) {
    report(`${label} reads history for an assigned task`, false, "no assigned active task");
    report(`${label} reads author and history participant profiles`, false, "no assigned active task");
    report(`${label} cannot read an unrelated profile`, false, "no assigned active task");
    return;
  }

  const { data: history, error: historyError } = await user.client
    .from("task_status_history")
    .select("id, actor_id")
    .eq("task_id", ownTask.id);
  report(`${label} reads history for an assigned task`, !historyError && history.length > 0, historyError ? errorCode(historyError) : "");

  const relatedIds = await checkExecutorReadsRelatedProfiles(user, label, ownTask, managerProfiles.client);
  await checkUnrelatedProfileHidden(user, label, relatedIds, managerProfiles.profiles, otherUser.userId);
}

async function main() {
  const missing = requiredVariables.filter((name) => !process.env[name]);
  if (missing.length) {
    report("Required environment variables are set", false, `missing: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  let cloudUrl;
  try {
    cloudUrl = new URL(process.env.SUPABASE_URL);
  } catch {
    report("Supabase URL is valid", false);
    process.exitCode = 1;
    return;
  }

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(cloudUrl.hostname);
  if (cloudUrl.protocol !== "https:" || isLocal) {
    report("Supabase URL points to a non-local HTTPS project", false);
    process.exitCode = 1;
    return;
  }

  report("Supabase URL points to a non-local HTTPS project", true);
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  const manager = await signIn("Manager", process.env.CRM_MANAGER_EMAIL, process.env.CRM_MANAGER_PASSWORD, cloudUrl.href, key);
  const executor1 = await signIn("Executor 1", process.env.CRM_EXECUTOR_1_EMAIL, process.env.CRM_EXECUTOR_1_PASSWORD, cloudUrl.href, key);
  const executor2 = await signIn("Executor 2", process.env.CRM_EXECUTOR_2_EMAIL, process.env.CRM_EXECUTOR_2_PASSWORD, cloudUrl.href, key);

  if (!manager || !executor1 || !executor2) {
    report("Cloud read scenarios", false, "skipped because an Auth sign-in failed");
    process.exitCode = 1;
    return;
  }

  const managerProfile = await readProfile("Manager", manager);
  const executor1Profile = await readProfile("Executor 1", executor1);
  const executor2Profile = await readProfile("Executor 2", executor2);
  if (!managerProfile || !executor1Profile || !executor2Profile) {
    report("Cloud read scenarios", false, "skipped because a test account has no expected profile role");
    process.exitCode = 1;
    return;
  }

  const managerObjects = await readActiveObjects(manager, "Manager");
  const managerTasks = await readActiveTasks(manager, "Manager");
  const { data: profiles, error: profilesError } = await manager.client
    .from("profiles")
    .select("id, role");
  report("Manager reads profiles needed for the checks", !profilesError, profilesError ? errorCode(profilesError) : "");

  if (!managerObjects || !managerTasks || profilesError || !profiles) {
    report("Executor isolation scenarios", false, "skipped because manager data could not be read");
    process.exitCode = 1;
    return;
  }

  const historyTaskIds = managerTasks.map((task) => task.id);
  let demoHistory = [];
  if (historyTaskIds.length) {
    const { data, error } = await manager.client
      .from("task_status_history")
      .select("id, task_id")
      .in("task_id", historyTaskIds);
    demoHistory = data ?? [];
    report("Manager reads active task history", !error, error ? errorCode(error) : "");
  } else {
    report("Manager reads active task history", false, "no active tasks available");
  }

  const distinctStatuses = new Set(managerTasks.map((task) => task.status));
  report("Demo data has 2–3 active objects", managerObjects.length >= 2 && managerObjects.length <= 3);
  report("Demo data has several active tasks", managerTasks.length >= 3);
  report("Demo data covers multiple task statuses", distinctStatuses.size >= 2);
  report("Demo data includes task history", demoHistory.length > 0);

  await checkExecutor("Executor 1", executor1, executor2, managerTasks, { client: manager.client, profiles });
  await checkExecutor("Executor 2", executor2, executor1, managerTasks, { client: manager.client, profiles });

  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((error) => {
  report("Script completed without an unexpected error", false, errorCode(error));
  process.exitCode = 1;
});
