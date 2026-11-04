import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { CloseIcon } from "./Icons";
import styles from "./Modal.module.css";

type Props = { title: string; children: ReactNode; onClose: () => void; closeDisabled?: boolean };

export function Modal({ title, children, onClose, closeDisabled = false }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current!;
    const returnFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(<dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!closeDisabled) onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const dialog = event.currentTarget;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')]
        .filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }}
    onClick={(event) => {
      if (event.target !== event.currentTarget || closeDisabled) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <header className={styles.header}>
      <h2 id={titleId}>{title}</h2>
      <Button variant="secondary" className={styles.close} aria-label="Закрыть" disabled={closeDisabled} onClick={onClose}><CloseIcon /></Button>
    </header>
    <div className={styles.body}>{children}</div>
  </dialog>, document.body);
}
