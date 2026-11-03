import { useEffect, useState } from "react";
import styles from "./TaskDetails.module.css";
import { getTaskDetails, listTaskHistory, transitionTaskStatus, type TaskDetailsData, type TaskStatus, type TaskStatusEvent } from "./tasksApi";

type Props = {
  taskId: string;
  isManager: boolean;
  onBack: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
};

export const statusNames: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  in_review: "На проверке",
  accepted: "Принята",
  rework: "На доработке",
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

export function TaskDetails({ taskId, isManager, onBack, onStatusChange }: Props) {
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
    void Promise.all([getTaskDetails(taskId), listTaskHistory(taskId)])
      .then(([taskData, historyData]) => {
        if (!active) return;
        setTask(taskData);
        setHistory(historyData);
        setHistoryError("");
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason, "Задача недоступна, удалена или не найдена."));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setHistoryLoading(false);
        }
      });
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
      await refreshHistory();
    } catch (reason) {
      setError(errorMessage(reason, "Не удалось изменить статус задачи."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.container} aria-label="Карточка задачи">
      <button className={styles.backButton} type="button" onClick={onBack}>← К списку задач</button>
      {loading ? <p role="status">Загружаем задачу…</p>
        : error && !task ? <div className={styles.errorBox} role="alert"><p>{error}</p><button className={styles.secondaryButton} type="button" onClick={onBack}>Вернуться к списку</button></div>
          : task && <>
            <header className={styles.header}>
              <div><p className={styles.eyebrow}>Карточка задачи</p><h2 id="task-details-title">{task.title}</h2></div>
              <span className={styles.status}>{statusNames[task.status]}</span>
            </header>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <dl className={styles.details}>
              <div><dt>Описание</dt><dd>{task.description || "—"}</dd></div>
              <div><dt>Объект</dt><dd>{task.object?.name ?? "Недоступен"}{task.object?.address ? ` · ${task.object.address}` : ""}</dd></div>
              <div><dt>Исполнитель</dt><dd>{task.assignee?.display_name ?? "Не указан"}</dd></div>
              <div><dt>Автор</dt><dd>{task.author?.display_name ?? "Не указан"}</dd></div>
              <div><dt>Создана</dt><dd>{new Date(task.created_at).toLocaleString()}</dd></div>
              <div><dt>Текущий статус</dt><dd>{statusNames[task.status]}</dd></div>
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
                    <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
                    <strong>{event.actor?.display_name ?? "Пользователь"}</strong>
                    <span>{event.from_status ? statusNames[event.from_status] : "—"} → {statusNames[event.to_status]}</span>
                    {event.comment && <p>{event.comment}</p>}
                  </li>)}</ol>}
            </section>
          </>}
    </section>
  );
}
