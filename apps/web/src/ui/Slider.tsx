import { useId, type KeyboardEvent } from "react";
import styles from "./ui.module.css";

/**
 * A 0–100 slider that distinguishes "not set" (null) from an explicit 0.
 * Keyboard: arrows move by step, Home/End jump to the ends.
 */
export function Slider(props: {
  /** The accessible name. */
  label: string;
  /**
   * What's shown above the slider, when it should differ from `label` (e.g. just "Forsaken"
   * under a "Gate creation" heading). null shows nothing. The accessible name stays `label`.
   */
  visibleLabel?: string | null;
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
  const ticks = Array.from(
    { length: Math.floor((max - min) / step) + 1 },
    (_, i) => min + i * step,
  );

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
      {props.visibleLabel === undefined ? (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      ) : (
        props.visibleLabel && (
          <span className={styles.label} aria-hidden="true">
            {props.visibleLabel}
          </span>
        )
      )}
      <div className={styles.scaleRow}>
        <div
          className={styles.scale}
          data-testid="slider-scale"
          aria-hidden="true"
        >
          {ticks.map((t) => (
            <span
              key={t}
              style={{ left: `${((t - min) / (max - min)) * 100}%` }}
              data-current={value === t || undefined}
            >
              {t}
            </span>
          ))}
        </div>
        <span className={styles.sliderValueSpacer} />
      </div>
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
          aria-label={props.visibleLabel === undefined ? undefined : label}
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
