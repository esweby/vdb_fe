import { getRouteApi, Link } from "@tanstack/react-router";
import { useCards } from "./useCards.ts";

const route = getRouteApi("/cards/$cardId");

/** A card's page. Scoring arrives in M5b. */
export function CardPage() {
  const { cardId } = route.useParams();
  const { status, items } = useCards();
  const card = items.find((c) => c.id === cardId);

  if (status !== "loaded") return <p>Loading…</p>;
  if (!card) {
    return (
      <>
        <h1>Card not found</h1>
        <Link to="/cards">Back to cards</Link>
      </>
    );
  }
  return (
    <>
      <Link to="/cards">← Cards</Link>
      <h1>{card.name}</h1>
    </>
  );
}
