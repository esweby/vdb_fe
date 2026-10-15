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
  /** A large dialog for whole views (e.g. a card's details and scoring). */
  wide?: boolean;
  /** Extra controls in the title bar, before Close. */
  headerExtra?: ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const { open } = props;
  // Read onClose through a ref, so a new handler each render doesn't re-run the effect
  // (which would pull focus back to Close while someone is using the dialog).
  const onClose = useRef(props.onClose);
  onClose.current = props.onClose;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) =>
      e.key === "Escape" && onClose.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className={styles.backdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${styles.dialog} ${props.wide ? styles.dialogWide : ""}`}
      >
        <div className={styles.dialogHeader}>
          <h2 id={titleId}>{props.title}</h2>
          <div className={styles.dialogHeaderActions}>
            {props.headerExtra}
            <Button ref={closeRef} variant="ghost" onClick={props.onClose}>
              Close
            </Button>
          </div>
        </div>
        <div>{props.children}</div>
        {props.actions && (
          <div className={styles.dialogActions}>{props.actions}</div>
        )}
      </div>
    </div>
  );
}
