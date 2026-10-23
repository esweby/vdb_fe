import type { KeyboardEvent } from "react";
import { CARD_TABS, type CardTab } from "./cardTabs.ts";
import styles from "./CardScoringPage.module.css";

export const tabId = (prefix: string, tab: CardTab) => `${prefix}-tab-${tab}`;
export const panelId = (prefix: string, tab: CardTab) =>
  `${prefix}-panel-${tab}`;

/**
 * The card's tabs. Only the selected tab is in the tab order; ← and → (Home and End) move
 * between them and select as they go.
 */
export function CardTabList(props: {
  idPrefix: string;
  tab: CardTab;
  onChoose: (tab: CardTab) => void;
}) {
  const { idPrefix, tab, onChoose } = props;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = CARD_TABS.findIndex((t) => t.id === tab);
    const last = CARD_TABS.length - 1;
    const next =
      e.key === "ArrowRight"
        ? at === last
          ? 0
          : at + 1
        : e.key === "ArrowLeft"
          ? at === 0
            ? last
            : at - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : undefined;
    if (next === undefined) return;
    e.preventDefault();
    const chosen = CARD_TABS[next]!.id;
    onChoose(chosen);
    document.getElementById(tabId(idPrefix, chosen))?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Card information"
      className={styles.tabs}
      onKeyDown={onKeyDown}
    >
      {CARD_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={tabId(idPrefix, t.id)}
          aria-selected={tab === t.id}
          aria-controls={panelId(idPrefix, t.id)}
          tabIndex={tab === t.id ? 0 : -1}
          className={styles.tab}
          onClick={() => onChoose(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
