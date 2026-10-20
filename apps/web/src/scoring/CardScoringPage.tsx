import { getRouteApi, Link } from "@tanstack/react-router";
import { SynergyNudge } from "../synergy/SynergyNudge.tsx";
import { CardScoringView } from "./CardScoringView.tsx";

const route = getRouteApi("/cards/$cardId");

/** A card's own page, for direct links (e.g. from the ranking or a deck). */
export function CardScoringPage() {
  const { cardId } = route.useParams();
  return (
    <>
      <Link to="/cards">← Cards</Link>
      <CardScoringView cardId={cardId} showTitle />
      <SynergyNudge focus={cardId} />
    </>
  );
}
