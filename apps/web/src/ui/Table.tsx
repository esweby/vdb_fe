import type { ReactNode } from "react";
import styles from "./ui.module.css";

export interface Column<Row> {
  key: string;
  header: string;
  /** Defaults to row[key]. */
  render?: (row: Row) => ReactNode;
}

export function Table<Row>(props: {
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  empty?: string;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.caption}>{props.caption}</caption>
        <thead>
          <tr>
            {props.columns.map((c) => (
              <th key={c.key} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.length === 0 ? (
            <tr>
              <td colSpan={props.columns.length} className={styles.empty}>
                {props.empty ?? "Nothing to show"}
              </td>
            </tr>
          ) : (
            props.rows.map((row) => (
              <tr key={props.rowKey(row)}>
                {props.columns.map((c) => (
                  <td key={c.key}>
                    {c.render
                      ? c.render(row)
                      : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
