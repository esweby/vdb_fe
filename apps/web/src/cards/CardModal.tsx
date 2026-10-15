import { useEffect } from "react";
import { CardScoringView } from "../scoring/CardScoringView.tsx";
import { Button, Dialog, Tag } from "../ui/index.ts";
import styles from "./CardModal.module.css";

/**
 * A card's details and scoring in a pop-over over the card database, so scorers stay in the
 * list. Previous and Next step through the current results (also ← and →, except while a
 * slider or text field has focus, where the arrows belong to it). Click outside, Escape or
 * ✕ closes it.
 */
export function CardModal(props: {
  cardId: string;
  name: string;
  verified: boolean;
  variantId?: string;
  /** 1-based place in the results, and how many there are. */
  position?: { index: number; total: number };
  previousId?: string;
  nextId?: string;
  onOpen: (cardId: string) => void;
  onClose: () => void;
}) {
  const { previousId, nextId, onOpen } = props;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [role=slider]")) return;
      if (e.key === "ArrowLeft" && previousId) onOpen(previousId);
      if (e.key === "ArrowRight" && nextId) onOpen(nextId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previousId, nextId, onOpen]);

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
            disabled={!previousId}
            onClick={() => previousId && onOpen(previousId)}
          >
            ‹
          </Button>
          {props.position && (
            <span>
              {props.position.index} of {props.position.total}
            </span>
          )}
          <Button
            variant="ghost"
            aria-label="Next card"
            title="Next card (→)"
            disabled={!nextId}
            onClick={() => nextId && onOpen(nextId)}
          >
            ›
          </Button>
        </span>
      }
    >
      <CardScoringView
        cardId={props.cardId}
        initialVariantId={props.variantId}
        onNext={nextId ? () => onOpen(nextId) : undefined}
        inPopover
      />
    </Dialog>
  );
}
