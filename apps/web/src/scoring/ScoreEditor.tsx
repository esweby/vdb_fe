import { useEffect, useState } from "react";
import { pitchName } from "../cards/pitch.ts";
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
  /** The pitch being looked at: it can get its own score under the all-pitches one. */
  chosenVariantId?: string;
}) {
  const { rows, onSet } = props;
  const hasSideRows = (dimensionId: number) =>
    rows.some((r) => r.dimensionId === dimensionId && r.side !== null);

  /** dimension id -> split by side */
  const [split, setSplit] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(
      props.dimensions.map((d) => [
        d.id,
        hasSideRows(d.id) || props.sidesTogetherByDefault === false,
      ]),
    ),
  );
  const multiPitch = props.variants.length > 1;
  const chosen = multiPitch
    ? (props.variants.find((v) => v.id === props.chosenVariantId) ??
      props.variants[0])
    : undefined;
  const hasOwnScores = (variantId: string) =>
    rows.some((r) => r.variantId === variantId);
  /** variant id -> scored separately from the other pitches */
  const [ownPitch, setOwnPitch] = useState<Record<string, boolean>>({});
  const pitchSeparate = chosen
    ? (ownPitch[chosen.id] ?? hasOwnScores(chosen.id))
    : false;

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
    if (!chosen) return;
    if (!separate) {
      // Removes this pitch's own scores only; other pitches keep theirs.
      for (const r of rows) {
        if (r.variantId === chosen.id) {
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
    setOwnPitch((o) => ({ ...o, [chosen.id]: separate }));
  }

  // Other pitches with their own scores aren't shown while looking at this one, so say so.
  const othersWithScores = props.variants.filter(
    (v) => v.id !== chosen?.id && hasOwnScores(v.id),
  );

  // One slider per rating: all pitches, or (ticked) the pitch being looked at, which falls
  // back to the all-pitches score when blank.
  const variants: (string | null)[] = [
    chosen && pitchSeparate ? chosen.id : null,
  ];
  const pitchOf = (id: string | null) =>
    props.variants.find((v) => v.id === id)?.pitch;

  return (
    <div>
      {chosen && (
        <div className={styles.toggles}>
          <label>
            <input
              type="checkbox"
              checked={pitchSeparate}
              onChange={(e) => setPitchSeparately(e.target.checked)}
            />
            Different score for {pitchName(chosen.pitch)}
          </label>
          {othersWithScores.length > 0 && (
            <span className={styles.others}>
              {othersWithScores.map((v) => pitchName(v.pitch)).join(" and ")}{" "}
              {othersWithScores.length === 1
                ? "has its own scores."
                : "have their own scores."}
            </span>
          )}
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
                    ? pitchName(pitchOf(variantId) ?? null)
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
                        // The tick box says which pitch; only the side needs a label.
                        side ? SIDE_LABEL[side] : null
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
