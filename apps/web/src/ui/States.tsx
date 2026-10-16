import { Button } from "./Button.tsx";
import styles from "./ui.module.css";

/** A page or panel that's loading: a quiet spinner and what it's waiting for. */
export function Loading(props: { label: string }) {
  return (
    <p className={styles.loading} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      {props.label}…
    </p>
  );
}

/** A load that failed, in plain words, with a retry. */
export function LoadError(props: { what: string; onRetry: () => void }) {
  return (
    <div className={styles.loadError} role="alert">
      <p>
        <strong>Couldn't load {props.what}.</strong> Check your connection and
        try again.
      </p>
      <Button onClick={props.onRetry}>Try again</Button>
    </div>
  );
}
