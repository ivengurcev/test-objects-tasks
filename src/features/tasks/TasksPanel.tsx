import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import styles from "./TasksPanel.module.css";
import { TaskDetails } from "./TaskDetails";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { createTask, deleteTask, listExecutors, listTasks, updateTask, type CrmTask, type ExecutorProfile, type TaskStatus } from "./tasksApi";

type Props = {
  objectId: string;
  isManager: boolean;
  onViewChange: (view: TaskPanelView) => void;
  onDataChange: () => void;
  onCreateActionChange: (action: (() => void) | null) => void;
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

export function TasksPanel({ objectId, isManager, onViewChange, onDataChange, onCreateActionChange }: Props) {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [executors, setExecutors] = useState<ExecutorProfile[]>([]);
  const [executorsLoading, setExecutorsLoading] = useState(isManager);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [executorError, setExecutorError] = useState("");
  const [formError, setFormError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [assigneeError, setAssigneeError] = useState("");
  const [view, setView] = useState<TaskView>({ kind: "list" });
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
  }, [objectId, isManager]);

  const navigate = (next: TaskView) => {
    setView(next);
    setFormError("");
    const returnToObject = () => {
      setView({ kind: "list" });
      setFormError("");
      onViewChange({ kind: "list" });
      void refreshTasks();
    };
    onViewChange(next.kind === "form"
      ? { kind: "form", title: next.mode === "create" ? "Создание задачи" : "Редактирование задачи" }
      : next.kind === "card" ? { kind: "card", onBack: returnToObject } : { kind: "list" });
  };

  const startCreate = useCallback(() => {
    setTitle("");
    setDescription("");
    setAssigneeId(executors[0]?.id ?? "");
    setView({ kind: "form", mode: "create" });
    setFormError("");
    setTitleError("");
    setAssigneeError("");
    onViewChange({ kind: "form", title: "Создание задачи" });
  }, [executors, onViewChange]);

  useEffect(() => {
    onCreateActionChange(isManager ? startCreate : null);
    return () => onCreateActionChange(null);
  }, [isManager, onCreateActionChange, startCreate]);

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

  return (
    <section className={styles.section} aria-label="Задачи объекта">
      {view.kind === "list" ? <>
        <div className={styles.heading}>
          <h2>Задачи объекта</h2>
        </div>
        {formError && <p className={styles.error} role="alert">{formError}</p>}
        {loading ? <p className={styles.muted} role="status">Загружаем задачи…</p>
          : loadError ? <div className={styles.empty}><p role="alert">{loadError}</p><button className={styles.secondaryButton} type="button" onClick={() => void refreshTasks()}>Повторить</button></div>
            : tasks.length === 0 ? <p className={styles.empty}>Для этого объекта пока нет задач.</p>
              : <ul className={styles.list}>{tasks.map((task) => <li className={styles.task} key={task.id}>
                <div className={styles.taskInfo}>
                  <button className={styles.taskLink} type="button" onClick={() => navigate({ kind: "card", taskId: task.id })}>{task.title}</button>
                  <TaskStatusBadge status={task.status} />
                  <span className={styles.muted}>Исполнитель: {task.assignee?.display_name ?? "Не указан"}</span>
                </div>
              </li>)}</ul>}
      </> : view.kind === "card" ? <TaskDetails
        key={view.taskId}
        taskId={view.taskId}
        isManager={isManager}
        onEdit={startEdit}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onDataChange={onDataChange}
      /> : <>
      <form className={styles.form} noValidate onSubmit={handleSave}>
          <label className={styles.field}>Название
            <input value={title} onChange={(event) => { setTitle(event.target.value); setTitleError(""); }} required aria-invalid={Boolean(titleError)} aria-describedby={titleError ? "task-title-error" : undefined} disabled={saving} />
            {titleError && <span id="task-title-error" className={styles.fieldError} role="alert">{titleError}</span>}
          </label>
          <label className={styles.field}>Описание
            <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} disabled={saving} />
          </label>
          <label className={styles.field}>Исполнитель
            <select value={assigneeId} onChange={(event) => { setAssigneeId(event.target.value); setAssigneeError(""); }} required aria-invalid={Boolean(assigneeError || executorError)} aria-describedby={[assigneeError && "task-assignee-error", executorError && "task-executor-error"].filter(Boolean).join(" ") || undefined} disabled={saving || executorsLoading || executors.length === 0}>
              <option value="" disabled>Выберите исполнителя</option>
              {executors.map((executor) => <option key={executor.id} value={executor.id}>{executor.display_name}</option>)}
            </select>
            {assigneeError && <span id="task-assignee-error" className={styles.fieldError} role="alert">{assigneeError}</span>}
            {executorError && <span id="task-executor-error" className={styles.fieldError} role="alert">{executorError}</span>}
          </label>
          {executorsLoading && <p className={styles.muted} role="status">Загружаем исполнителей…</p>}
          {!executorsLoading && !executorError && executors.length === 0 && <p className={styles.muted}>Нет доступных исполнителей.</p>}
          {formError && <p className={styles.error} role="alert">{formError}</p>}
          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={saving || executorsLoading || executors.length === 0}>{saving ? "Сохраняем…" : "Сохранить"}</button>
            <button className={styles.secondaryButton} type="button" disabled={saving} onClick={() => navigate(view.mode === "create" ? { kind: "list" } : { kind: "card", taskId: view.task.id })}>Отмена</button>
          </div>
        </form>
      </>}
    </section>
  );
}
