import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

type Props = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, description, icon, action }: Props) {
  return <div className={styles.empty}>
    {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {action && <div className={styles.action}>{action}</div>}
  </div>;
}
