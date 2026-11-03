import { useEffect, useState, type SubmitEvent } from "react";
import styles from "./TasksPanel.module.css";
import { TaskDetails, statusNames } from "./TaskDetails";
import { createTask, deleteTask, listExecutors, listTasks, updateTask, type CrmTask, type ExecutorProfile, type TaskStatus } from "./tasksApi";

type Props = {
  objectId: string;
  isManager: boolean;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? `${fallback} ${error.message}` : fallback;
}

export function TasksPanel({ objectId, isManager }: Props) {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [executors, setExecutors] = useState<ExecutorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [executorError, setExecutorError] = useState("");
  const [formError, setFormError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
      void listExecutors().then((result) => {
        setExecutors(result);
        setAssigneeId((current) => current || result[0]?.id || "");
      }).catch((error: unknown) => setExecutorError(errorMessage(error, "Не удалось загрузить список исполнителей.")));
    }
  }, [objectId, isManager]);

  const startCreate = () => {
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setAssigneeId(executors[0]?.id ?? "");
    setFormError("");
    setFormOpen(true);
  };

  const startEdit = (task: CrmTask) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setAssigneeId(task.assignee_id);
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingTask(null);
    setFormError("");
  };

  const handleSave = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const cleanTitle = title.trim();
    if (!cleanTitle || !assigneeId) {
      setFormError("Укажите название задачи и выберите исполнителя.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      if (editingTask) {
        await updateTask(editingTask.id, cleanTitle, description.trim(), assigneeId);
      } else {
        await createTask(objectId, cleanTitle, description.trim(), assigneeId);
      }
      setFormOpen(false);
      setEditingTask(null);
      await refreshTasks();
    } catch (error) {
      setFormError(errorMessage(error, "Не удалось сохранить задачу. Проверьте права доступа и попробуйте ещё раз."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (task: CrmTask) => {
    if (saving) return;
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    setSaving(true);
    setFormError("");
    try {
      await deleteTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (error) {
      setFormError(errorMessage(error, "Не удалось удалить задачу. Проверьте права доступа и попробуйте ещё раз."));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status } : task));
  };

  return (
    <section className={styles.section} aria-labelledby="tasks-title">
      <div className={styles.heading}>
        <h2 id="tasks-title">Задачи объекта</h2>
        {isManager && !formOpen && <button className={styles.primaryButton} type="button" onClick={startCreate}>Добавить задачу</button>}
      </div>

      {selectedTaskId ? <TaskDetails
        taskId={selectedTaskId}
        isManager={isManager}
        onBack={() => { setSelectedTaskId(null); void refreshTasks(); }}
        onStatusChange={handleStatusChange}
      /> : <>
      {formError && <p className={styles.error} role="alert">{formError}</p>}
      {formOpen && <form className={styles.form} onSubmit={handleSave}>
        <h3>{editingTask ? "Редактировать задачу" : "Новая задача"}</h3>
        <label className={styles.field}>Название
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label className={styles.field}>Описание
          <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className={styles.field}>Исполнитель
          <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} required disabled={saving || executors.length === 0}>
            <option value="" disabled>Выберите исполнителя</option>
            {executors.map((executor) => <option key={executor.id} value={executor.id}>{executor.display_name}</option>)}
          </select>
        </label>
        {executorError && <p className={styles.error} role="alert">{executorError}</p>}
        {!executorError && executors.length === 0 && <p className={styles.muted}>Нет доступных исполнителей.</p>}
        <div className={styles.actions}>
          <button className={styles.primaryButton} type="submit" disabled={saving || executors.length === 0}>{saving ? "Сохраняем…" : "Сохранить"}</button>
          <button className={styles.secondaryButton} type="button" onClick={closeForm} disabled={saving}>Отмена</button>
        </div>
      </form>}

      {loading ? <p className={styles.muted} role="status">Загружаем задачи…</p>
        : loadError ? <div className={styles.empty}><p role="alert">{loadError}</p><button className={styles.secondaryButton} type="button" onClick={() => void refreshTasks()}>Повторить</button></div>
          : tasks.length === 0 ? <p className={styles.empty}>Для этого объекта пока нет задач.</p>
            : <ul className={styles.list}>{tasks.map((task) => <li className={styles.task} key={task.id}>
              <div className={styles.taskInfo}>
                <button className={styles.taskLink} type="button" onClick={() => setSelectedTaskId(task.id)}>{task.title}</button>
                <span className={styles.status}>{statusNames[task.status]}</span>
                <span className={styles.muted}>Исполнитель: {task.assignee?.display_name ?? "Не указан"}</span>
              </div>
              {isManager && <div className={styles.actions}>
                <button className={styles.secondaryButton} type="button" disabled={saving} onClick={() => startEdit(task)}>Редактировать</button>
                <button className={styles.dangerButton} type="button" disabled={saving} onClick={() => void handleDelete(task)}>Удалить</button>
              </div>}
            </li>)}</ul>}
      </>}
    </section>
  );
}
