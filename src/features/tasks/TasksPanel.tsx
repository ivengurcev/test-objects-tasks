import { useEffect, useState, type SubmitEvent } from "react";
import styles from "./TasksPanel.module.css";
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

  const startCreate = () => {
    setTitle("");
    setDescription("");
    setAssigneeId(executors[0]?.id ?? "");
    navigate({ kind: "form", mode: "create" });
  };

  const startEdit = (task: Pick<CrmTask, "id" | "title" | "description" | "assignee_id">) => {
    setTitle(task.title);
    setDescription(task.description);
    setAssigneeId(task.assignee_id);
    navigate({ kind: "form", mode: "edit", task });
  };

  const handleSave = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || view.kind !== "form") return;
    const cleanTitle = title.trim();
    if (!cleanTitle || !assigneeId) {
      setFormError("Укажите название задачи и выберите исполнителя.");
      return;
    }

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
          {isManager && <button className={styles.primaryButton} type="button" onClick={startCreate}>Создать задачу</button>}
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
        <form className={styles.form} onSubmit={handleSave}>
          {formError && <p className={styles.error} role="alert">{formError}</p>}
          <label className={styles.field}>Название
            <input value={title} onChange={(event) => setTitle(event.target.value)} required disabled={saving} />
          </label>
          <label className={styles.field}>Описание
            <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} disabled={saving} />
          </label>
          <label className={styles.field}>Исполнитель
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} required disabled={saving || executorsLoading || executors.length === 0}>
              <option value="" disabled>Выберите исполнителя</option>
              {executors.map((executor) => <option key={executor.id} value={executor.id}>{executor.display_name}</option>)}
            </select>
          </label>
          {executorError && <p className={styles.error} role="alert">{executorError}</p>}
          {executorsLoading && <p className={styles.muted} role="status">Загружаем исполнителей…</p>}
          {!executorsLoading && !executorError && executors.length === 0 && <p className={styles.muted}>Нет доступных исполнителей.</p>}
          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={saving || executorsLoading || executors.length === 0}>{saving ? "Сохраняем…" : "Сохранить"}</button>
            <button className={styles.secondaryButton} type="button" disabled={saving} onClick={() => navigate(view.mode === "create" ? { kind: "list" } : { kind: "card", taskId: view.task.id })}>Отмена</button>
          </div>
        </form>
      </>}
    </section>
  );
}
