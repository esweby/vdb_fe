import { useEffect, useState } from "react";
import { Slider } from "../ui/index.ts";
import { cellValue } from "./inherited.ts";
import type { Dimension, ScoreKey, ScoreRow } from "./scoreRepository.ts";
import styles from "./ScoreEditor.module.css";

const SIDE_LABEL = { forsaken: "Forsaken", usurper: "Usurper" } as const;

/**
 * Sliders for each rating. What's shown always matches what's saved: a rating with per-side
 * scores opens split by side, and going back to one score for both sides removes them (the
 * same for per-pitch scores), so no hidden score ever counts.
 */
export function ScoreEditor(props: {
  dimensions: Dimension[];
  variants: { id: string; pitch: number | null }[];
  rows: ScoreRow[];
  /** score null = clear back to blank */
  onSet: (key: ScoreKey, score: number | null) => void;
  sidesTogetherByDefault?: boolean;
  /** Dimensions shown greyed out and disabled, keeping their place, with why. */
  locked?: { ids: number[]; reason: string };
}) {
  const { rows, onSet } = props;
  const hasSideRows = (dimensionId: number) =>
    rows.some((r) => r.dimensionId === dimensionId && r.side !== null);
  const hasPitchRows = rows.some((r) => r.variantId !== null);

  /** dimension id -> split by side */
  const [split, setSplit] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(
      props.dimensions.map((d) => [
        d.id,
        hasSideRows(d.id) || props.sidesTogetherByDefault === false,
      ]),
    ),
  );
  const [perPitch, setPerPitch] = useState(hasPitchRows);
  const multiPitch = props.variants.length > 1;

  // Scores often load after the editor appears: open anything with per-side or per-pitch
  // scores, so they're never hidden. It only ever opens; closing is the user's choice.
  useEffect(() => {
    setSplit((current) => {
      const opened = props.dimensions.filter(
        (d) =>
          rows.some((r) => r.dimensionId === d.id && r.side !== null) &&
          !current[d.id],
      );
      if (opened.length === 0) return current;
      return {
        ...current,
        ...Object.fromEntries(opened.map((d) => [d.id, true])),
      };
    });
    if (rows.some((r) => r.variantId !== null)) setPerPitch(true);
  }, [rows, props.dimensions]);

  function setTogether(dimensionId: number, together: boolean) {
    if (together) {
      for (const r of rows) {
        if (r.dimensionId === dimensionId && r.side !== null) {
          onSet({ variantId: r.variantId, side: r.side, dimensionId }, null);
        }
      }
    }
    setSplit((s) => ({ ...s, [dimensionId]: !together }));
  }

  function setPitchSeparately(separate: boolean) {
    if (!separate) {
      for (const r of rows) {
        if (r.variantId !== null) {
          onSet(
            {
              variantId: r.variantId,
              side: r.side,
              dimensionId: r.dimensionId,
            },
            null,
          );
        }
      }
    }
    setPerPitch(separate);
  }

  const variants: (string | null)[] = [
    null,
    ...(multiPitch && perPitch ? props.variants.map((v) => v.id) : []),
  ];
  const pitchOf = (id: string | null) =>
    props.variants.find((v) => v.id === id)?.pitch;

  return (
    <div>
      {multiPitch && (
        <div className={styles.toggles}>
          <label>
            <input
              type="checkbox"
              checked={perPitch}
              onChange={(e) => setPitchSeparately(e.target.checked)}
            />
            Score each pitch separately
          </label>
        </div>
      )}

      {props.dimensions.map((dimension) => {
        const locked = props.locked?.ids.includes(dimension.id) ?? false;
        const together = !split[dimension.id];
        const sides: ScoreKey["side"][] = together
          ? [null]
          : ["forsaken", "usurper"];
        return (
          <fieldset
            key={dimension.id}
            className={`${styles.dimension} ${locked ? styles.locked : ""}`}
            disabled={locked}
          >
            <legend>{dimension.label}</legend>
            <label
              className={styles.sideToggle}
              title="One score for both hero sides; untick to score Forsaken and Usurper apart"
            >
              <input
                type="checkbox"
                aria-label={`Same score for both sides: ${dimension.label}`}
                checked={together}
                onChange={(e) => setTogether(dimension.id, e.target.checked)}
              />
              Both sides
            </label>
            {locked && (
              <p className={styles.lockedReason}>{props.locked!.reason}</p>
            )}
            {variants.flatMap((variantId) =>
              sides.map((side) => {
                const key: ScoreKey = {
                  variantId,
                  side,
                  dimensionId: dimension.id,
                };
                const { own, inherited } = cellValue(rows, key);
                const suffix = [
                  variantId !== null
                    ? `pitch ${pitchOf(variantId) ?? "–"}`
                    : null,
                  side ? SIDE_LABEL[side] : null,
                ]
                  .filter(Boolean)
                  .join(", ");
                const label = suffix
                  ? `${dimension.label}, ${suffix}`
                  : dimension.label;
                const named = (action: string) =>
                  suffix ? `${action}: ${suffix}` : action;
                return (
                  <div key={`${variantId}-${side}`} className={styles.cell}>
                    <Slider
                      label={label}
                      visibleLabel={
                        suffix
                          ? suffix[0]!.toUpperCase() + suffix.slice(1)
                          : null
                      }
                      value={own}
                      quietScale
                      onChange={(score) => onSet(key, score)}
                    />
                    <div className={styles.cellActions}>
                      {own === null && inherited !== null && (
                        <span className={styles.inherited}>
                          Inherits {inherited}
                        </span>
                      )}
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={named("Not relevant")}
                        title="Not relevant (0)"
                        onClick={() => onSet(key, 0)}
                      >
                        ⊘
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={named("Clear")}
                        title="Clear (back to blank)"
                        disabled={own === null}
                        onClick={() => onSet(key, null)}
                      >
                        ↺
                      </button>
                    </div>
                  </div>
                );
              }),
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
