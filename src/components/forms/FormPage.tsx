import type { ReactNode, SubmitEvent } from "react";
import { ArrowLeftIcon } from "../Icons";
import styles from "./FormPage.module.css";

type Props = {
  title: string;
  backLabel: string;
  backHref: string;
  onBack: () => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  saving: boolean;
  error?: string;
  children: ReactNode;
  actions: ReactNode;
};

export function FormPage({ title, backLabel, backHref, onBack, onSubmit, saving, error, children, actions }: Props) {
  return <section className={styles.page}>
    <a className={styles.back} href={backHref} aria-disabled={saving || undefined} tabIndex={saving ? -1 : undefined} onClick={(event) => {
      if (saving) { event.preventDefault(); return; }
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); onBack();
    }}><ArrowLeftIcon /><span>{backLabel}</span></a>
    <h1>{title}</h1>
    <form className={styles.panel} noValidate onSubmit={onSubmit}>
      {children}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {actions}
    </form>
  </section>;
}
