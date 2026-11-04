import { useEffect, useState, type SubmitEvent } from "react";
import { Button } from "../../components/Button";
import { ArrowLeftIcon, ClockIcon } from "../../components/Icons";
import { Modal } from "../../components/Modal";
import { TaskActions } from "../../components/TaskActions";
import { FormField } from "../../components/forms/FormField";
import { TextArea } from "../../components/forms/FormControls";
import { navigate } from "../../app/navigation";
import styles from "./TaskDetails.module.css";
import { getTaskDetails, listTaskHistory, transitionTaskStatus, type TaskDetailsData, type TaskStatus, type TaskStatusEvent } from "./tasksApi";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { reworkCommentError } from "./formValidation";
import { shouldShowEmptyHistory } from "./historyView";

type Props = {
  taskId: string;
  objectId?: string;
  isManager: boolean;
  onBack?: () => void;
  backHref?: string;
  backLabel?: string;
  onEdit?: (task: TaskDetailsData) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete?: (task: TaskDetailsData) => Promise<void>;
  onDataChange: () => void;
};

const actionNames: Partial<Record<TaskStatus, string>> = {
  in_progress: "Начать работу",
  in_review: "Отправить на проверку",
  accepted: "Принять задачу",
  rework: "Отправить на доработку",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? `${fallback} ${error.message}` : fallback;
}

export function TaskDetails({ taskId, objectId, isManager, onBack, backHref: backHrefOverride, backLabel: backLabelOverride, onEdit, onStatusChange, onDelete, onDataChange }: Props) {
  const [task, setTask] = useState<TaskDetailsData | null>(null);
  const [history, setHistory] = useState<TaskStatusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [recordError, setRecordError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<"history" | "rework" | null>(null);

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

  const changeStatus = async (newStatus: TaskStatus, reworkComment: string | null = null) => {
    if (!task || saving) return;
    setSaving(true);
    setStatusError("");
    try {
      await transitionTaskStatus(task.id, newStatus, reworkComment);
      setTask((current) => current ? { ...current, status: newStatus } : current);
      onStatusChange(task.id, newStatus);
      setComment("");
      if (newStatus === "rework") setModal(null);
      onDataChange();
      await refreshHistory();
    } catch (reason) {
      setStatusError(errorMessage(reason, "Не удалось изменить статус задачи."));
    } finally {
      setSaving(false);
    }
  };

  const handleRework = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const validationError = reworkCommentError(comment);
    setCommentError(validationError ?? "");
    if (validationError) {
      event.currentTarget.querySelector<HTMLTextAreaElement>("textarea")?.focus();
      return;
    }
    void changeStatus("rework", comment.trim());
  };

  const handleDelete = async () => {
    if (!task || !onDelete || saving || !window.confirm(`Удалить задачу «${task.title}»?`)) return;
    setSaving(true);
    setRecordError("");
    try {
      await onDelete(task);
    } catch (reason) {
      setRecordError(errorMessage(reason, "Не удалось удалить задачу."));
    } finally {
      setSaving(false);
    }
  };

  const parentObjectId = task?.object_id ?? objectId;
  const backHref = backHrefOverride ?? (parentObjectId ? `/objects/${parentObjectId}` : "/my-tasks");

  return <section className={styles.container} aria-label="Карточка задачи">
    <a className={styles.back} href={backHref} onClick={(event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); if (onBack) onBack(); else navigate(backHref);
    }}><ArrowLeftIcon /><span>{backLabelOverride ?? (parentObjectId ? "К объекту" : "К моим задачам")}</span></a>
    {loading ? <p role="status">Загружаем задачу…</p>
      : error && !task ? <div className={styles.errorBox} role="alert"><p>{error}</p></div>
        : task && <>
          <header className={styles.header}>
            <div className={styles.summary}>
              <h1 id="task-details-title">{task.title}</h1>
              <p>Исполнитель: {task.assignee?.display_name ?? "Не указан"}</p>
            </div>
            {isManager && <div className={styles.recordActions}>
              {onEdit && <Button variant="outline" className={styles.recordButton} disabled={saving} onClick={() => onEdit(task)}>Редактировать</Button>}
              {onDelete && <Button variant="danger-text" className={styles.recordButton} disabled={saving} onClick={() => void handleDelete()}>Удалить</Button>}
            </div>}
          </header>
          <p className={styles.metadata}>Постановщик: {task.author?.display_name ?? "Не указан"} · Создана: {new Date(task.created_at).toLocaleString()}</p>
          {recordError && <p className={styles.error} role="alert">{recordError}</p>}
          <div className={styles.statusRow}>
            <TaskStatusBadge status={task.status} />
            <Button variant="outline" className={styles.historyButton} disabled={saving} onClick={() => { setModal("history"); void refreshHistory(); }}><ClockIcon />История статусов</Button>
          </div>
          <section className={styles.description} aria-labelledby="task-description-title">
            <h2 id="task-description-title">Описание</h2>
            <p>{task.description || "—"}</p>
          </section>
          {actions.length > 0 && <TaskActions>
            {statusError && modal !== "rework" && <p className={styles.error} role="alert">{statusError}</p>}
            <div className={styles.actions}>
              {actions.map((status) => <Button key={status} variant={status === "rework" ? "danger" : "primary"} disabled={saving} onClick={() => {
                if (status === "rework") { setComment(""); setCommentError(""); setStatusError(""); setModal("rework"); }
                else void changeStatus(status);
              }}>{saving ? "Сохраняем…" : status === "in_progress" && task.status === "rework" ? "Возобновить работу" : actionNames[status]}</Button>)}
            </div>
          </TaskActions>}
        </>}
    {modal === "history" && <Modal title="История статусов" onClose={() => setModal(null)}>
      {historyError && <div className={styles.errorBox} role="alert"><p>{historyError}</p><Button variant="secondary" onClick={() => void refreshHistory()}>Повторить</Button></div>}
      {historyLoading ? <p role="status">Загружаем историю…</p>
        : shouldShowEmptyHistory(historyLoading, Boolean(historyError), history.length) ? <p className={styles.metadata}>История пока пуста.</p>
          : !historyError && <ol className={styles.events} tabIndex={0}>{history.map((event) => <li key={event.id}>
            <div className={styles.eventTop}>
              <TaskStatusBadge status={event.to_status} />
              <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
            </div>
            <strong>{event.actor?.display_name ?? "Пользователь"}</strong>
            {event.comment && <p className={styles.comment}>{event.comment}</p>}
          </li>)}</ol>}
    </Modal>}
    {modal === "rework" && <Modal title="Вернуть на доработку" onClose={() => setModal(null)} closeDisabled={saving}>
      <form className={styles.reworkForm} aria-label="Возврат на доработку" noValidate onSubmit={handleRework}>
        <p className={styles.metadata}>Укажите, что нужно исправить. Комментарий обязателен и сохранится в истории статусов.</p>
        <FormField id="rework-comment" label="Комментарий" error={commentError}>
          <TextArea id="rework-comment" autoFocus rows={4} value={comment} required disabled={saving}
            aria-invalid={Boolean(commentError)} aria-describedby={commentError ? "rework-comment-error" : undefined}
            onChange={(event) => { setComment(event.target.value); setCommentError(""); }} />
        </FormField>
        {statusError && <p className={styles.error} role="alert">{statusError}</p>}
        <div className={styles.modalActions}>
          <Button variant="secondary" disabled={saving} onClick={() => setModal(null)}>Отмена</Button>
          <Button type="submit" disabled={saving}>{saving ? "Сохраняем…" : "На доработку"}</Button>
        </div>
      </form>
    </Modal>}
  </section>;
}
