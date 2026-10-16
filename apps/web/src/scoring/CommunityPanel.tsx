import type { CommunityRow } from "../ranking/rank.ts";
import type { Dimension } from "./scoreRepository.ts";
import styles from "./CardScoringPage.module.css";

const SIDES = [
  ["forsaken", "Forsaken"],
  ["usurper", "Usurper"],
] as const;
// Overall first, as in the ratings.
const ORDER = ["overall", "floor", "ceiling"];

/**
 * The scoring group's ratings for one pitch of a card: each rating on each side, and how many
 * people it's from. Below the minimum it says so rather than showing a score that means little.
 */
export function CommunityPanel(props: {
  rows: CommunityRow[];
  dimensions: Dimension[];
  variantId: string | undefined;
  minRatingCount: number;
}) {
  const rows = props.rows.filter((r) => r.variantId === props.variantId);
  const ratings = Math.max(0, ...rows.map((r) => r.ratingCount));
  const dimensions = [...props.dimensions].sort(
    (a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key),
  );
  const score = (side: string, dimensionId: number) =>
    rows.find((r) => r.side === side && r.dimensionId === dimensionId)?.score;

  return (
    <section aria-label="Scoring group" className={styles.community}>
      <h2>Scoring group</h2>
      {ratings === 0 ? (
        <p className={styles.muted}>No ratings yet.</p>
      ) : ratings < props.minRatingCount ? (
        <p className={styles.muted}>
          Not enough ratings yet: {ratings} of the {props.minRatingCount}{" "}
          needed.
        </p>
      ) : (
        <>
          <table className={styles.communityTable}>
            <thead>
              <tr>
                <td />
                {SIDES.map(([id, label]) => (
                  <th key={id} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dimensions.map((d) => (
                <tr key={d.id}>
                  <th scope="row">{d.label}</th>
                  {SIDES.map(([side]) => (
                    <td key={side}>
                      {score(side, d.id) === undefined
                        ? "–"
                        : Math.round(score(side, d.id)!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.muted}>From {ratings} ratings</p>
        </>
      )}
    </section>
  );
}
