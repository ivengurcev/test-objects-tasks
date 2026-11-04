import type { ReactNode } from "react";
import styles from "./TaskActions.module.css";

export function TaskActions({ children }: { children: ReactNode }) {
  return <footer className={styles.panel} aria-label="Действия со статусом">{children}</footer>;
}
