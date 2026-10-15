import { useEffect, useState } from "react";
import { Button, Dialog } from "../ui/index.ts";
import {
  reviewSummary,
  suggestedFixes,
  summaryRows,
  type Source,
} from "./reviewSummary.ts";
import type { Dimension, ScoreRow } from "./scoreRepository.ts";
import styles from "./ReviewDialog.module.css";

export function ReviewDialog(props: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onFix: (dimensionId: number, score: number) => void;
  rows: ScoreRow[];
  dimensions: Dimension[];
  variants: { id: string; pitch: number | null }[];
  /** The card has conditions, so a blank floor or ceiling is worth a second look. */
  hasConditions?: boolean;
  busy?: boolean;
}) {
  // A blank floor or ceiling counts as overall. On a card with conditions that's often a
  // slip, so those cells are highlighted until the scorer confirms them (it never blocks).
  const [confirmedSame, setConfirmedSame] = useState(false);
  useEffect(() => {
    if (props.open) setConfirmedSame(false);
  }, [props.open]);
  const summary = reviewSummary(props.rows, props.dimensions, props.variants);
  const fixes = suggestedFixes(props.rows, props.dimensions, props.variants);
  const checkSame =
    !!props.hasConditions &&
    !confirmedSame &&
    summary.some((c) => c.source === "same_as_overall");
  const needsAttention = (source: Source) =>
    source === "blank" || (checkSame && source === "same_as_overall");

  return (
    <Dialog
      title="Mark reviewed"
      open={props.open}
      onClose={props.onClose}
      actions={
        <Button
          variant="primary"
          onClick={props.onConfirm}
          disabled={props.busy}
        >
          Confirm review
        </Button>
      }
    >
      <p>
        Once reviewed, your scores count toward community scores. A blank floor
        or ceiling counts as the same as overall; other blanks count as 0.
      </p>
      {checkSame && (
        <div className={styles.fixes}>
          <p>
            Floor and ceiling are blank, so they'll count as the same as
            overall. This card has conditions: check that's right.
          </p>
          <Button onClick={() => setConfirmedSame(true)}>
            Yes, same as overall
          </Button>
        </div>
      )}
      {fixes.length > 0 && (
        <div className={styles.fixes}>
          <p>Some pitches or sides are blank on dimensions you've scored:</p>
          {fixes.map((fix) => (
            <Button
              key={fix.dimensionId}
              onClick={() => props.onFix(fix.dimensionId, fix.score)}
            >
              {fix.label}: {fix.description}
            </Button>
          ))}
        </div>
      )}
      {props.dimensions.map((d) => (
        <table key={d.id} className={styles.table}>
          <caption>{d.label}</caption>
          <tbody>
            {summaryRows(
              summary.filter((c) => c.dimensionId === d.id),
              props.variants,
              { flagSameAsOverall: checkSame },
            ).map((row) => (
              <tr key={row.where}>
                <th scope="row">{row.where}</th>
                <td
                  className={row.attention ? styles.blank : undefined}
                  data-attention={row.attention || undefined}
                >
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </Dialog>
  );
}
