import styles from "./ui.module.css";

/** Page numbers to show: the first, the last and the current page's neighbours, with gaps. */
export function pageItems(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const keep = new Set(
    [1, pageCount, page - 1, page, page + 1].filter(
      (p) => p >= 1 && p <= pageCount,
    ),
  );
  const sorted = [...keep].sort((a, b) => a - b);
  return sorted.flatMap((p, i) =>
    i > 0 && p - sorted[i - 1]! > 1 ? (["…", p] as const) : [p],
  );
}

export function Pagination(props: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const { page, pageCount, onChange } = props;
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pages" className={styles.pagination}>
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ‹ Previous
      </button>
      {pageItems(page, pageCount).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className={styles.pageGap} aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        Next ›
      </button>
    </nav>
  );
}
