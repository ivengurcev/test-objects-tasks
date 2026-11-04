import type { ReactNode } from "react";
import styles from "./FormField.module.css";

type Props = { id: string; label: string; error?: string; children: ReactNode };

export function FormField({ id, label, error, children }: Props) {
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    {children}
    {error && <span id={`${id}-error`} className={styles.error} role="alert">{error}</span>}
  </div>;
}
