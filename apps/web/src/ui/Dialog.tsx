import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button.tsx";
import styles from "./ui.module.css";

// Open dialogs, newest last: Escape closes only the topmost (e.g. the review summary on top
// of a card), and the page underneath can't scroll while any is open.
const openDialogs: symbol[] = [];
let scrollBefore = "";

function lockScroll() {
  if (openDialogs.length === 1) {
    scrollBefore = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}
function unlockScroll() {
  if (openDialogs.length === 0) document.body.style.overflow = scrollBefore;
}

/**
 * A modal dialog. Escape, a click outside it, or Close calls onClose; focus moves into it on
 * open; the page behind stops scrolling.
 */
export function Dialog(props: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  /** A large dialog for whole views (e.g. a card's details and scoring). */
  wide?: boolean;
  /** Next to the title, e.g. a "Verified" tag. */
  titleExtra?: ReactNode;
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
    const me = Symbol("dialog");
    openDialogs.push(me);
    lockScroll();
    closeRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && openDialogs.at(-1) === me) onClose.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      openDialogs.splice(openDialogs.indexOf(me), 1);
      unlockScroll();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className={styles.backdrop}
      data-testid="dialog-backdrop"
      onClick={(e) => {
        // Only a click on the backdrop itself, not one inside the dialog.
        if (e.target === e.currentTarget) onClose.current();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${styles.dialog} ${props.wide ? styles.dialogWide : ""}`}
      >
        <div className={styles.dialogHeader}>
          <div className={styles.dialogTitle}>
            <h2 id={titleId}>{props.title}</h2>
            {props.titleExtra}
          </div>
          <div className={styles.dialogHeaderActions}>
            {props.headerExtra}
            <Button
              ref={closeRef}
              variant="ghost"
              aria-label="Close"
              title="Close (Esc)"
              onClick={props.onClose}
            >
              ✕
            </Button>
          </div>
        </div>
        <div className={styles.dialogBody}>{props.children}</div>
        {props.actions && (
          <div className={styles.dialogActions}>{props.actions}</div>
        )}
      </div>
    </div>
  );
}
