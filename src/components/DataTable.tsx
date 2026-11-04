import type { CSSProperties, ReactNode } from "react";
import styles from "./DataTable.module.css";

type Props<T extends { id: string }> = {
  label: string;
  headers: readonly { label: string; align?: "center" }[];
  columns: string;
  items: readonly T[];
  href: (item: T) => string;
  onNavigate: (item: T) => void;
  renderRow: (item: T) => ReactNode;
  emptyState: ReactNode;
  notice?: ReactNode;
  className?: string;
};

export function DataTable<T extends { id: string }>({ label, headers, columns, items, href, onNavigate, renderRow, emptyState, notice, className = "" }: Props<T>) {
  return <div className={`${styles.table} ${items.length === 0 ? styles.empty : ""} ${className}`}
    style={{ "--data-table-columns": columns } as CSSProperties}>
    {items.length === 0 ? emptyState : <>
      <div className={styles.heading} aria-hidden="true">
        {headers.map((header) => <span className={header.align === "center" ? styles.center : undefined} key={header.label}>{header.label}</span>)}
        <span />
      </div>
      {notice}
      <ul className={styles.list} aria-label={label}>
        {items.map((item) => <li key={item.id}>
          <a className={styles.row} href={href(item)} onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault(); onNavigate(item);
          }}>
            {renderRow(item)}
            <span className={styles.arrow} aria-hidden="true">›</span>
          </a>
        </li>)}
      </ul>
    </>}
  </div>;
}
