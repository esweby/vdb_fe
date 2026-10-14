import { Button, Dialog } from "../ui/index.ts";
import { reviewSummary, suggestedFixes, type Source } from "./reviewSummary.ts";
import type { Dimension, ScoreRow } from "./scoreRepository.ts";
import styles from "./ReviewDialog.module.css";

const SOURCE_LABEL: Record<Source, string> = {
  set: "set",
  inherited: "inherited",
  not_relevant: "not relevant",
  blank: "blank",
};

export function ReviewDialog(props: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onFix: (dimensionId: number, score: number) => void;
  rows: ScoreRow[];
  dimensions: Dimension[];
  variants: { id: string; pitch: number | null }[];
  busy?: boolean;
}) {
  const summary = reviewSummary(props.rows, props.dimensions, props.variants);
  const fixes = suggestedFixes(props.rows, props.dimensions, props.variants);
  const multiPitch = props.variants.length > 1;

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
        Once reviewed, your scores count toward community scores. Blanks count
        as 0.
      </p>
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
            {summary
              .filter((c) => c.dimensionId === d.id)
              .map((c) => (
                <tr key={`${c.variantId}-${c.side}`}>
                  <th scope="row">
                    {multiPitch ? `Pitch ${c.pitch ?? "–"}, ` : ""}
                    {c.side === "forsaken" ? "Forsaken" : "Usurper"}
                  </th>
                  <td
                    className={c.source === "blank" ? styles.blank : undefined}
                  >
                    {c.value} ({SOURCE_LABEL[c.source]})
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      ))}
    </Dialog>
  );
}
