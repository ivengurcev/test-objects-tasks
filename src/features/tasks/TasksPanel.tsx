import { useEffect, useLayoutEffect, useState, type SubmitEvent } from "react";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { TaskListIcon } from "../../components/Icons";
import { navigate as navigateTo, usePathname } from "../../app/navigation";
import { parseRoute } from "../../app/routes";
import styles from "./TasksPanel.module.css";
import { TaskForm } from "./TaskForm";
import { TaskDetails } from "./TaskDetails";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { createTask, deleteTask, listExecutors, listTasks, updateTask, type CrmTask, type ExecutorProfile, type TaskStatus } from "./tasksApi";

type Props = {
  objectId: string;
  isManager: boolean;
  onViewChange: (view: TaskPanelView) => void;
  onDataChange: () => void;
};

export type TaskPanelView =
  | { kind: "list" }
  | { kind: "card"; onBack: () => void }
  | { kind: "form"; title: string };

type TaskView =
  | { kind: "list" }
  | { kind: "card"; taskId: string }
  | { kind: "form"; mode: "create" }
  | { kind: "form"; mode: "edit"; task: Pick<CrmTask, "id" | "title" | "description" | "assignee_id"> };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? `${fallback} ${error.message}` : fallback;
}

export function TasksPanel({ objectId, isManager, onViewChange, onDataChange }: Props) {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [executors, setExecutors] = useState<ExecutorProfile[]>([]);
  const [executorsLoading, setExecutorsLoading] = useState(isManager);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [executorError, setExecutorError] = useState("");
  const [formError, setFormError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [assigneeError, setAssigneeError] = useState("");
  const pathname = usePathname();
  const route = parseRoute(pathname);
  const [formView, setFormView] = useState<{ path: string; view: TaskView } | null>(null);
  const view: TaskView = formView?.path === pathname ? formView.view
    : route.kind === "task" ? { kind: "card", taskId: route.taskId } : { kind: "list" };
  const setView = (next: TaskView) => {
    if (next.kind === "form") setFormView({ path: pathname, view: next });
    else {
      setFormView(null);
      navigateTo(next.kind === "card" ? `/objects/${objectId}/tasks/${next.taskId}` : `/objects/${objectId}`);
    }
  };
  useEffect(() => { setFormView(null); setFormError(""); }, [pathname]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);

  const refreshTasks = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setTasks(await listTasks(objectId));
    } catch (error) {
      setLoadError(errorMessage(error, "Не удалось загрузить задачи. Проверьте подключение и права доступа."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshTasks();
    if (isManager) {
      setExecutorsLoading(true);
      void listExecutors().then((result) => {
        setExecutors(result);
        setAssigneeId((current) => current || result[0]?.id || "");
        setExecutorError("");
      }).catch((error: unknown) => setExecutorError(errorMessage(error, "Не удалось загрузить список исполнителей.")))
        .finally(() => setExecutorsLoading(false));
    }
  }, [objectId, isManager, pathname]);

  const navigate = (next: TaskView) => {
    setView(next);
    setFormError("");
  };

  useLayoutEffect(() => {
    const returnToObject = () => {
      setView({ kind: "list" });
      setFormError("");
      void refreshTasks();
    };
    onViewChange(view.kind === "form"
      ? { kind: "form", title: view.mode === "create" ? "Создание задачи" : "Редактирование задачи" }
      : view.kind === "card" ? { kind: "card", onBack: returnToObject } : { kind: "list" });
  }, [view.kind, view.kind === "card" ? view.taskId : view.kind === "form" ? view.mode : "", onViewChange, objectId]);

  const startCreate = () => {
    setTitle("");
    setDescription("");
    setAssigneeId(executors[0]?.id ?? "");
    setView({ kind: "form", mode: "create" });
    setFormError("");
    setTitleError("");
    setAssigneeError("");
    onViewChange({ kind: "form", title: "Создание задачи" });
  };

  const startEdit = (task: Pick<CrmTask, "id" | "title" | "description" | "assignee_id">) => {
    setTitle(task.title);
    setDescription(task.description);
    setAssigneeId(task.assignee_id);
    setFormError("");
    setTitleError("");
    setAssigneeError("");
    navigate({ kind: "form", mode: "edit", task });
  };

  const handleSave = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || view.kind !== "form") return;
    const cleanTitle = title.trim();
    const nextTitleError = cleanTitle ? "" : "Укажите название задачи.";
    const nextAssigneeError = assigneeId ? "" : "Выберите исполнителя.";
    setTitleError(nextTitleError);
    setAssigneeError(nextAssigneeError);
    if (nextTitleError || nextAssigneeError) return;

    setSaving(true);
    setFormError("");
    try {
      const taskId = view.mode === "create"
        ? await createTask(objectId, cleanTitle, description.trim(), assigneeId)
        : (await updateTask(view.task.id, cleanTitle, description.trim(), assigneeId), view.task.id);
      navigate({ kind: "card", taskId });
      void refreshTasks();
      onDataChange();
    } catch (error) {
      setFormError(errorMessage(error, "Не удалось сохранить задачу. Проверьте права доступа и попробуйте ещё раз."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task: CrmTask) => {
    if (saving) return;
    setSaving(true);
    setFormError("");
    try {
      await deleteTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      onDataChange();
      navigate({ kind: "list" });
    } catch (error) {
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status } : task));
  };

  const hasNoTasks = !loading && !loadError && tasks.length === 0;

  return (
    <section className={styles.section} aria-label="Задачи объекта">
      {view.kind === "list" ? <>
        <div className={styles.taskHeading}>
          <h2>Задачи <span className={styles.taskTotal}>{loading || loadError ? "—" : tasks.length}</span></h2>
          {isManager && !hasNoTasks && <Button onClick={startCreate}>+ Создать задачу</Button>}
        </div>
        {formError && <p className={styles.error} role="alert">{formError}</p>}
        {loading ? <p className={styles.muted} role="status">Загружаем задачи…</p>
          : loadError ? <div className={styles.empty}><p role="alert">{loadError}</p><button className={styles.secondaryButton} type="button" onClick={() => void refreshTasks()}>Повторить</button></div>
            : <DataTable
              label="Задачи объекта"
              headers={[{ label: "Название задачи" }, { label: "Исполнитель" }, { label: "Статус" }]}
              columns="minmax(0, 1fr) minmax(140px, 240px) 150px 20px"
              className={styles.taskTableLayout}
              items={tasks}
              href={(task) => `/objects/${objectId}/tasks/${task.id}`}
              onNavigate={(task) => navigate({ kind: "card", taskId: task.id })}
              emptyState={<EmptyState
                icon={<TaskListIcon />}
                title="Задач пока нет"
                description="Создайте первую задачу для этого объекта"
                action={isManager ? <Button onClick={startCreate}>+ Создать задачу</Button> : undefined}
              />}
              renderRow={(task) => <>
                <strong className={styles.taskTitle}>{task.title}</strong>
                <span className={styles.taskAssignee}><span className={styles.assigneeLabel}>Исполнитель: </span>{task.assignee?.display_name ?? "Не указан"}</span>
                <span className={styles.taskStatus}><TaskStatusBadge status={task.status} /></span>
              </>}
            />}
      </> : view.kind === "card" ? <TaskDetails
        key={view.taskId}
        taskId={view.taskId}
        objectId={objectId}
        onBack={() => navigate({ kind: "list" })}
        isManager={isManager}
        onEdit={startEdit}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onDataChange={onDataChange}
      /> : <TaskForm
        mode={view.mode}
        backHref={view.mode === "create" ? `/objects/${objectId}` : `/objects/${objectId}/tasks/${view.task.id}`}
        title={title} description={description} assigneeId={assigneeId}
        titleError={titleError} assigneeError={assigneeError} executorError={executorError}
        executors={executors} executorsLoading={executorsLoading} error={formError} saving={saving}
        onTitleChange={(value) => { setTitle(value); setTitleError(""); }}
        onDescriptionChange={setDescription}
        onAssigneeChange={(value) => { setAssigneeId(value); setAssigneeError(""); }}
        onSubmit={handleSave}
        onCancel={() => navigate(view.mode === "create" ? { kind: "list" } : { kind: "card", taskId: view.task.id })}
      />}
    </section>
  );
}
