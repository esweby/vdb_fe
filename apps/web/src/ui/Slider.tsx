import { useId, type KeyboardEvent } from "react";
import styles from "./ui.module.css";

/**
 * A 0–100 slider that distinguishes "not set" (null) from an explicit 0.
 * Keyboard: arrows move by step, Home/End jump to the ends.
 */
export function Slider(props: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const { label, value, onChange, min = 0, max = 100, step = 10 } = props;
  const id = useId();
  const text = value === null ? "Not set" : String(value);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const current = value ?? min;
    const next = {
      ArrowRight: current + step,
      ArrowUp: current + step,
      ArrowLeft: current - step,
      ArrowDown: current - step,
      Home: min,
      End: max,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(
      clamp(value === null && event.key.startsWith("Arrow") ? min : next),
    );
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.sliderRow}>
        <input
          id={id}
          type="range"
          className={styles.slider}
          data-unset={value === null || undefined}
          min={min}
          max={max}
          step={step}
          value={value ?? min}
          aria-valuetext={text}
          onChange={(e) => onChange(Number(e.target.value))}
          onKeyDown={onKeyDown}
        />
        <output htmlFor={id} className={styles.sliderValue}>
          {text}
        </output>
      </div>
    </div>
  );
}
