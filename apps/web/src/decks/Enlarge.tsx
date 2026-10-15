import { useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "../ui/index.ts";
import styles from "./Enlarge.module.css";

/** A magnifying glass over a card's picture that opens it full size. */
export function Enlarge(props: {
  name: string;
  src: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
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
      {/* Rendered at the page level, so the tile's clipping and image styles don't reach it. */}
      {open &&
        createPortal(
          <Dialog title={props.name} open onClose={() => setOpen(false)}>
            <img className={styles.large} src={props.src} alt={props.name} />
          </Dialog>,
          document.body,
        )}
    </>
  );
}
