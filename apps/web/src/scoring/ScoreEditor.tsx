import { useState } from "react";
import { Button, Slider } from "../ui/index.ts";
import { cellValue } from "./inherited.ts";
import type { Dimension, ScoreKey, ScoreRow } from "./scoreRepository.ts";
import styles from "./ScoreEditor.module.css";

const SIDE_LABEL = { forsaken: "Forsaken", usurper: "Usurper" } as const;

export function ScoreEditor(props: {
  dimensions: Dimension[];
  variants: { id: string; pitch: number | null }[];
  rows: ScoreRow[];
  /** score null = clear back to blank */
  onSet: (key: ScoreKey, score: number | null) => void;
  sidesTogetherByDefault?: boolean;
}) {
  const [sidesTogether, setSidesTogether] = useState(
    props.sidesTogetherByDefault ?? true,
  );
  const [perPitch, setPerPitch] = useState(false);
  const multiPitch = props.variants.length > 1;

  const sides: ScoreKey["side"][] = sidesTogether
    ? [null]
    : ["forsaken", "usurper"];
  const variants: (string | null)[] = [
    null,
    ...(multiPitch && perPitch ? props.variants.map((v) => v.id) : []),
  ];
  const pitchOf = (id: string | null) =>
    props.variants.find((v) => v.id === id)?.pitch;

  return (
    <div>
      <div className={styles.toggles}>
        <label>
          <input
            type="checkbox"
            checked={sidesTogether}
            onChange={(e) => setSidesTogether(e.target.checked)}
          />
          Same score for both sides
        </label>
        {multiPitch && (
          <label>
            <input
              type="checkbox"
              checked={perPitch}
              onChange={(e) => setPerPitch(e.target.checked)}
            />
            Score each pitch separately
          </label>
        )}
      </div>

      {props.dimensions.map((dimension) => (
        <fieldset key={dimension.id} className={styles.dimension}>
          <legend>{dimension.label}</legend>
          {variants.flatMap((variantId) =>
            sides.map((side) => {
              const key: ScoreKey = {
                variantId,
                side,
                dimensionId: dimension.id,
              };
              const { own, inherited } = cellValue(props.rows, key);
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
                    value={own}
                    onChange={(score) => props.onSet(key, score)}
                  />
                  <div className={styles.cellFooter}>
                    {own === null && inherited !== null && (
                      <span className={styles.inherited}>
                        Inherits {inherited}
                      </span>
                    )}
                    <Button variant="ghost" onClick={() => props.onSet(key, 0)}>
                      {named("Not relevant")}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={own === null}
                      onClick={() => props.onSet(key, null)}
                    >
                      {named("Clear")}
                    </Button>
                  </div>
                </div>
              );
            }),
          )}
        </fieldset>
      ))}
    </div>
  );
}
