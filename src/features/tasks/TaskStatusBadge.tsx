import type { TaskStatus } from "./tasksApi";
import styles from "./TaskStatusBadge.module.css";

export const statusNames: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  in_review: "На проверке",
  accepted: "Принята",
  rework: "На доработке",
};

const statusClasses: Record<TaskStatus, string> = {
  new: styles.new,
  in_progress: styles.inProgress,
  in_review: styles.inReview,
  accepted: styles.accepted,
  rework: styles.rework,
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`${styles.badge} ${statusClasses[status]}`}>{statusNames[status]}</span>;
}
