import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button.tsx";
import styles from "./ui.module.css";

/** A modal dialog. Escape or the Close button calls onClose; focus moves into it on open. */
export function Dialog(props: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { open, onClose } = props;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) =>
      e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={styles.backdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.dialog}
      >
        <div className={styles.dialogHeader}>
          <h2 id={titleId}>{props.title}</h2>
          <Button ref={closeRef} variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div>{props.children}</div>
        {props.actions && (
          <div className={styles.dialogActions}>{props.actions}</div>
        )}
      </div>
    </div>
  );
}
