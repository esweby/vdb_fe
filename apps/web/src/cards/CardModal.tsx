import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CardScoringView } from "../scoring/CardScoringView.tsx";
import { Button, Dialog, Tag } from "../ui/index.ts";
import ui from "../ui/ui.module.css";
import styles from "./CardModal.module.css";

/**
 * A card's details and scoring in a pop-over over the card database, so scorers stay in the
 * list. Previous and Next step through the current results (also ← and →, except while a
 * slider, text field or tab has focus, where the arrows belong to it). Click outside, Escape or
 * ✕ closes it. It has the card page's tabs, kept in the list's URL as ?cardTab=, which carry
 * over from card to card, and "Open full page" on the same tab.
 */
export function CardModal(props: {
  cardId: string;
  name: string;
  verified: boolean;
  variantId?: string;
  /** 1-based place in the results, and how many there are. */
  position?: { index: number; total: number };
  /** Undefined at either end of the results. */
  onPrevious?: () => void;
  onNext?: () => void;
  /** The next different card (after a review, its other pitches are done too). */
  onNextCard?: () => void;
  /** Choosing a pitch in the pop-over moves your place in the results. */
  onChooseVariant?: (variantId: string) => void;
  onClose: () => void;
}) {
  const { onPrevious, onNext } = props;
  const { cardTab } = useSearch({ strict: false }) as { cardTab?: unknown };
  const navigate = useNavigate();

  // Moving to another card keeps focus where it was (often a slider), so the dialog's new title
  // isn't read out: say it instead. Nothing on first opening (M8 keyboard pass).
  const [said, setSaid] = useState("");
  const shown = useRef(props.cardId);
  const { cardId, name, position } = props;
  useEffect(() => {
    if (shown.current === cardId) return;
    shown.current = cardId;
    setSaid(
      `Now showing ${name}${position ? `, ${position.index.toLocaleString("en-GB")} of ${position.total.toLocaleString("en-GB")}` : ""}.`,
    );
  }, [cardId, name, position]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [role=slider], [role=tab]"))
        return;
      if (e.key === "ArrowLeft") onPrevious?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrevious, onNext]);

  return (
    <Dialog
      title={props.name}
      open
      wide
      onClose={props.onClose}
      titleExtra={
        <Tag tone={props.verified ? "accent" : "neutral"}>
          {props.verified ? "Verified" : "Unverified"}
        </Tag>
      }
      headerExtra={
        <span className={styles.nav}>
          <Button
            variant="ghost"
            aria-label="Previous card"
            title="Previous card (←)"
            disabled={!onPrevious}
            onClick={() => onPrevious?.()}
          >
            ‹
          </Button>
          {props.position && (
            <span>
              {props.position.index.toLocaleString("en-GB")} of{" "}
              {props.position.total.toLocaleString("en-GB")}
            </span>
          )}
          <Button
            variant="ghost"
            aria-label="Next card"
            title="Next card (→)"
            disabled={!onNext}
            onClick={() => onNext?.()}
          >
            ›
          </Button>
        </span>
      }
    >
      <p role="status" aria-label="Current card" className={ui.visuallyHidden}>
        {said}
      </p>
      <CardScoringView
        cardId={props.cardId}
        initialVariantId={props.variantId}
        onNext={onNext}
        onNextCard={props.onNextCard}
        onChooseVariant={props.onChooseVariant}
        inPopover
        tab={cardTab}
        onChooseTab={(tab) =>
          void navigate({
            to: ".",
            replace: true,
            resetScroll: false,
            search: (prev: Record<string, unknown>) => ({
              ...prev,
              cardTab: tab,
            }),
          })
        }
        tabsExtra={(tab) => (
          <Link
            to="/cards/$cardId"
            params={{ cardId: props.cardId }}
            search={{ tab }}
            className={styles.fullPage}
          >
            Open full page
          </Link>
        )}
      />
    </Dialog>
  );
}
