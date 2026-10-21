import { getRouteApi, Link } from "@tanstack/react-router";
import { CardScoringView } from "./CardScoringView.tsx";

const route = getRouteApi("/cards/$cardId");

/** A card's own page, for direct links (e.g. from the ranking or a deck). ?tab= picks the tab. */
export function CardScoringPage() {
  const { cardId } = route.useParams();
  const { tab } = route.useSearch();
  const navigate = route.useNavigate();
  return (
    <>
      <Link to="/cards">← Cards</Link>
      <CardScoringView
        cardId={cardId}
        showTitle
        tab={tab}
        onChooseTab={(next) =>
          void navigate({
            to: ".",
            replace: true,
            resetScroll: false,
            search: { tab: next },
          })
        }
      />
    </>
  );
}
