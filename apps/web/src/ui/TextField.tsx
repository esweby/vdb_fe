import { useId, type InputHTMLAttributes } from "react";
import styles from "./ui.module.css";

export function TextField({
  label,
  error,
  hint,
  hideLabel,
  className,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  hint?: string;
  /** Keep the label for screen readers only (e.g. a search box with a placeholder). */
  hideLabel?: boolean;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={styles.field}>
      <label
        htmlFor={id}
        className={hideLabel ? styles.visuallyHidden : styles.label}
      >
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
        className={[styles.input, className].filter(Boolean).join(" ")}
      />
      {error ? (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
