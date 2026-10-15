import { useEffect } from "react";
import { CardScoringView } from "../scoring/CardScoringView.tsx";
import { Button, Dialog } from "../ui/index.ts";

/**
 * A card's details and scoring in a pop-over over the card database, so scorers stay in the
 * list. Previous and Next step through the current results (also ← and →, except while a
 * slider or text field has focus, where the arrows belong to it).
 */
export function CardModal(props: {
  cardId: string;
  name: string;
  variantId?: string;
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
      headerExtra={
        <>
          <Button
            variant="ghost"
            aria-label="Previous card"
            disabled={!previousId}
            onClick={() => previousId && onOpen(previousId)}
          >
            ‹ Previous
          </Button>
          <Button
            variant="ghost"
            aria-label="Next card"
            disabled={!nextId}
            onClick={() => nextId && onOpen(nextId)}
          >
            Next ›
          </Button>
        </>
      }
    >
      <CardScoringView
        cardId={props.cardId}
        initialVariantId={props.variantId}
      />
    </Dialog>
  );
}
