import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./Enlarge.module.css";

/**
 * A magnifying glass over a card's picture. It opens a lightbox: the card large on a dark
 * backdrop, closed by Escape, a click anywhere or Close.
 */
export function Enlarge(props: {
  name: string;
  src: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const back = opener.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
      back?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={opener}
        type="button"
        className={`${styles.magnify} ${props.className ?? ""}`}
        aria-label={`Enlarge ${props.name}`}
        title="Enlarge"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle
            cx="11"
            cy="11"
            r="6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="m16 16 4.5 4.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {/* At the page level, so the tile's clipping and image styles don't reach it. */}
      {open &&
        createPortal(
          <div
            className={styles.lightbox}
            role="dialog"
            aria-modal="true"
            aria-label={props.name}
            onClick={() => setOpen(false)}
          >
            <img className={styles.large} src={props.src} alt={props.name} />
            <button
              ref={close}
              type="button"
              className={styles.close}
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
