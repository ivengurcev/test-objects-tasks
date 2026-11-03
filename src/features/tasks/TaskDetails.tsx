import { useEffect, useState } from "react";
import styles from "./TaskDetails.module.css";
import { getTaskDetails, listTaskHistory, transitionTaskStatus, type TaskDetailsData, type TaskStatus, type TaskStatusEvent } from "./tasksApi";
import { TaskStatusBadge } from "./TaskStatusBadge";

type Props = {
  taskId: string;
  isManager: boolean;
  onEdit: (task: TaskDetailsData) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (task: TaskDetailsData) => Promise<void>;
  onDataChange: () => void;
};

const actionNames: Partial<Record<TaskStatus, string>> = {
  in_progress: "Начать работу",
  in_review: "Отправить на проверку",
  accepted: "Принять задачу",
  rework: "Вернуть на доработку",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? `${fallback} ${error.message}` : fallback;
}

export function TaskDetails({ taskId, isManager, onEdit, onStatusChange, onDelete, onDataChange }: Props) {
  const [task, setTask] = useState<TaskDetailsData | null>(null);
  const [history, setHistory] = useState<TaskStatusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const refreshHistory = async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      setHistory(await listTaskHistory(taskId));
    } catch (reason) {
      setHistoryError(errorMessage(reason, "Не удалось загрузить историю задачи."));
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setTask(null);
    setHistory([]);
    setHistoryLoading(true);

    void getTaskDetails(taskId)
      .then((taskData) => { if (active) setTask(taskData); })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason, "Задача недоступна, удалена или не найдена."));
      })
      .finally(() => { if (active) setLoading(false); });

    void listTaskHistory(taskId)
      .then((historyData) => {
        if (active) {
          setHistory(historyData);
          setHistoryError("");
        }
      })
      .catch((reason: unknown) => {
        if (active) setHistoryError(errorMessage(reason, "Не удалось загрузить историю задачи."));
      })
      .finally(() => { if (active) setHistoryLoading(false); });

    return () => { active = false; };
  }, [taskId]);

  const actions: TaskStatus[] = task
    ? isManager
      ? task.status === "in_review" ? ["accepted", "rework"] : []
      : task.status === "new" ? ["in_progress"]
        : task.status === "in_progress" ? ["in_review"]
          : task.status === "rework" ? ["in_progress"] : []
    : [];

  const handleTransition = async (newStatus: TaskStatus) => {
    if (!task || saving) return;
    const cleanComment = comment.trim();
    if (newStatus === "rework" && !cleanComment) {
      setError("Укажите комментарий для возврата задачи на доработку.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await transitionTaskStatus(task.id, newStatus, newStatus === "rework" ? cleanComment : null);
      setTask((current) => current ? { ...current, status: newStatus } : current);
      onStatusChange(task.id, newStatus);
      setComment("");
      onDataChange();
      await refreshHistory();
    } catch (reason) {
      setError(errorMessage(reason, "Не удалось изменить статус задачи."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task || saving || !window.confirm(`Удалить задачу «${task.title}»?`)) return;
    setSaving(true);
    setError("");
    try {
      await onDelete(task);
    } catch (reason) {
      setError(errorMessage(reason, "Не удалось удалить задачу."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.container} aria-label="Карточка задачи">
      {loading ? <p role="status">Загружаем задачу…</p>
        : error && !task ? <div className={styles.errorBox} role="alert"><p>{error}</p></div>
          : task && <>
            <header className={styles.header}>
              <h1 id="task-details-title">Задача: {task.title}</h1>
              <p className={styles.subtitle}>Постановщик: {task.author?.display_name ?? "Не указан"}</p>
            </header>
            {isManager && <div className={styles.recordActions}>
              <button className={styles.secondaryButton} type="button" onClick={() => onEdit(task)}>Редактировать</button>
              <button className={styles.dangerButton} type="button" disabled={saving} onClick={() => void handleDelete()}>Удалить</button>
            </div>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <dl className={styles.details}>
              <div><dt>Текущий статус</dt><dd><TaskStatusBadge status={task.status} /></dd></div>
              <div><dt>Описание</dt><dd>{task.description || "—"}</dd></div>
              <div><dt>Объект</dt><dd>{task.object?.name ?? "Недоступен"}{task.object?.address ? ` · ${task.object.address}` : ""}</dd></div>
              <div><dt>Исполнитель</dt><dd>{task.assignee?.display_name ?? "Не указан"}</dd></div>
              <div><dt>Создана</dt><dd>{new Date(task.created_at).toLocaleString()}</dd></div>
            </dl>

            {actions.length > 0 && <section className={styles.actionsSection} aria-label="Действия со статусом">
              {isManager && task.status === "in_review" && actions.includes("rework") && <label className={styles.field}>Комментарий для доработки
                <textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} disabled={saving} />
              </label>}
              <div className={styles.actions}>
                {actions.map((status) => <button
                  className={status === "rework" ? styles.dangerButton : styles.primaryButton}
                  key={status}
                  type="button"
                  disabled={saving}
                  onClick={() => void handleTransition(status)}
                >{saving ? "Сохраняем…" : status === "in_progress" && task.status === "rework" ? "Возобновить работу" : actionNames[status]}</button>)}
              </div>
            </section>}

            <section className={styles.history} aria-labelledby="task-history-title">
              <h3 id="task-history-title">История изменений</h3>
              {historyError && <div className={styles.errorBox} role="alert"><p>{historyError}</p><button className={styles.secondaryButton} type="button" onClick={() => void refreshHistory()}>Повторить</button></div>}
              {historyLoading ? <p role="status">Загружаем историю…</p>
                : history.length === 0 ? <p className={styles.muted}>История пока пуста.</p>
                  : <ol className={styles.events}>{history.map((event) => <li key={event.id}>
                    <div className={styles.eventTop}>
                      <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
                      <TaskStatusBadge status={event.to_status} />
                    </div>
                    <div className={styles.eventBottom}>
                      <strong title={event.actor?.display_name ?? "Пользователь"}>{event.actor?.display_name ?? "Пользователь"}</strong>
                      {event.comment && <span className={styles.comment} title={event.comment}>{event.comment}</span>}
                    </div>
                  </li>)}</ol>}
            </section>
          </>}
    </section>
  );
}
