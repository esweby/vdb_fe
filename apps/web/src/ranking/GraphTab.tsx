import { useState } from "react";
import type { GraphLink, GraphNode } from "./graphView.ts";
import styles from "./GraphTab.module.css";

/** The circle's radius in SVG units; labels sit outside it. */
const R = 200;
const KIND_LABEL: Record<GraphLink["kind"], string> = {
  rule: "rules",
  community: "scoring group",
  both: "rules and scoring group",
};

/** Long names are cut so labels don't run past the edge. */
const short = (name: string) =>
  name.length > 24 ? `${name.slice(0, 23)}…` : name;

/**
 * The synergy graph (README "Phase Two" step 2), as a chord diagram: every card on one circle,
 * the core together on one arc, links curving through the middle. The rules' links are solid,
 * the scoring group's dashed, and links both agree on heavier. Links stay pale until you point
 * at a card, which picks out its own. The lists beside it say the same in words.
 */
export function GraphTab(props: { nodes: GraphNode[]; links: GraphLink[] }) {
  const [focus, setFocus] = useState<string | null>(null);
  if (props.nodes.length === 0)
    return (
      <p className={styles.empty}>
        Add cards to your core to see how they link.
      </p>
    );

  const byId = new Map(props.nodes.map((n) => [n.id, n]));
  const name = (id: string) => byId.get(id)?.name ?? id;
  const touches = (l: GraphLink) =>
    focus === null || l.from === focus || l.to === focus;

  return (
    <div className={styles.graph}>
      <figure className={styles.figure}>
        <svg
          role="img"
          aria-label="Synergy graph"
          viewBox="-380 -380 760 760"
          className={styles.svg}
        >
          <defs>
            <marker
              id="graph-arrow"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerUnits="userSpaceOnUse"
              markerWidth="9"
              markerHeight="9"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" className={styles.arrow} />
            </marker>
          </defs>
          {props.links.map((l) => {
            const a = byId.get(l.from)!;
            const b = byId.get(l.to)!;
            // Start and end just inside the dots, curving towards the centre.
            const start = (R - 9) / R;
            const end = (R - 12) / R;
            const cx = ((a.x + b.x) / 2) * R * 0.25;
            const cy = ((a.y + b.y) / 2) * R * 0.25;
            return (
              <path
                key={`${l.from}→${l.to}`}
                d={`M${a.x * R * start},${a.y * R * start} Q${cx},${cy} ${b.x * R * end},${b.y * R * end}`}
                fill="none"
                className={[
                  styles.link,
                  styles[l.kind],
                  focus === null
                    ? styles.resting
                    : touches(l)
                      ? styles.picked
                      : styles.faded,
                ]
                  .filter(Boolean)
                  .join(" ")}
                strokeWidth={0.5 + l.weight * 2.5}
                markerEnd="url(#graph-arrow)"
              />
            );
          })}
          {props.nodes.map((n) => {
            // Labels point out from the centre; on the left they're turned to read upright.
            const degrees = (n.angle * 180) / Math.PI - 90;
            const left = n.angle > Math.PI;
            return (
              <g
                key={n.id}
                className={[
                  styles.node,
                  n.inCore && styles.core,
                  focus === n.id && styles.focused,
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => setFocus(n.id)}
                onMouseLeave={() => setFocus(null)}
              >
                <circle cx={n.x * R} cy={n.y * R} r={7} />
                <text
                  transform={`translate(${n.x * (R + 14)} ${n.y * (R + 14)}) rotate(${left ? degrees + 180 : degrees})`}
                  textAnchor={left ? "end" : "start"}
                  dominantBaseline="middle"
                >
                  {short(n.name)}
                </text>
              </g>
            );
          })}
        </svg>
        <figcaption className={styles.legend}>
          <span>
            <span className={`${styles.swatch} ${styles.coreSwatch}`} /> In your
            core
          </span>
          <span>
            <span className={`${styles.line} ${styles.ruleLine}`} /> Rules
          </span>
          <span>
            <span className={`${styles.line} ${styles.communityLine}`} />{" "}
            Scoring group
          </span>
          <span>
            <span className={`${styles.line} ${styles.bothLine}`} /> Both
          </span>
          <span>Thicker is stronger. Arrows point at the card helped.</span>
        </figcaption>
      </figure>

      <div className={styles.lists}>
        <section>
          <h3>Cards</h3>
          <ul aria-label="Cards shown">
            {props.nodes.map((n) => (
              <li
                key={n.id}
                onMouseEnter={() => setFocus(n.id)}
                onMouseLeave={() => setFocus(null)}
              >
                {n.name}
                {n.inCore && " (in your core)"}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Links</h3>
          {props.links.length === 0 ? (
            <p className={styles.empty}>No links between these cards yet.</p>
          ) : (
            <ul aria-label="Links shown">
              {props.links.map((l) => (
                <li key={`${l.from}→${l.to}`}>
                  {name(l.from)} helps {name(l.to)} · {KIND_LABEL[l.kind]} ·{" "}
                  {l.weight}
                  {l.traverse && " · enables traverse"}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
