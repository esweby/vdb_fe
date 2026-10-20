import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CardModal } from "../cards/CardModal.tsx";
import { cardFacets } from "../cards/facets.ts";
import {
  isClassCard,
  newestFirst,
  searchAndSort,
} from "../cards/filterCards.ts";
import { applyFilters } from "../filters/applyFilters.ts";
import { FilteredLayout } from "../filters/FilteredLayout.tsx";
import { FilterBar } from "../filters/FilterBar.tsx";
import { FilterSidebar } from "../filters/FilterSidebar.tsx";
import { useUrlFilters, type ListSearch } from "../filters/useUrlFilters.ts";
import type { CardSummary } from "../cards/cardRepository.ts";
import { useCards } from "../cards/useCards.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { Button, LoadError, Loading } from "../ui/index.ts";
import ui from "../ui/ui.module.css";
import styles from "./NeedsReviewPage.module.css";

const route = getRouteApi("/needs-review");
const facets = cardFacets();

function Section(props: { title: string; cards: CardSummary[] }) {
  return (
    <section aria-label={props.title} className={styles.section}>
      <h2>
        {props.title}{" "}
        <span className={styles.count}>({props.cards.length})</span>
      </h2>
      {props.cards.length === 0 ? (
        <p className={styles.done}>All reviewed.</p>
      ) : (
        <ul className={styles.list}>
          {props.cards.map((c) => (
            <li key={c.id}>
              {/* Opens the pop-over here, so the scorer stays in the list. */}
              <Link
                to="/needs-review"
                search={(prev: ListSearch) => ({
                  ...prev,
                  card: c.id,
                  variant: undefined,
                })}
                resetScroll={false}
              >
                {c.name}
              </Link>
              {c.firstSet && (
                <span className={styles.set}> · {c.firstSet}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Cards the signed-in scorer hasn't marked reviewed: Runeblade and Shadow first, generics last,
 * each newest release first. Cards open in the pop-over and step through this list in order; a
 * reviewed card drops off it.
 */
export function NeedsReviewPage() {
  const { status, items, retry } = useCards();
  const { scores } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const [reviewed, setReviewed] = useState<Set<string> | null>(null);
  const [reviewsFailed, setReviewsFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const search = route.useSearch();
  const filters = useUrlFilters(search);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    let live = true;
    setReviewsFailed(false);
    scores.listMyReviewedCardIds(user.id).then(
      (ids) => live && setReviewed(new Set(ids)),
      () => live && setReviewsFailed(true),
    );
    return () => {
      live = false;
    };
  }, [scores, user, attempt]);

  const unreviewed = useMemo(
    () =>
      searchAndSort(
        items.filter((c) => !reviewed?.has(c.id)),
        "",
        "name",
      ).sort(newestFirst),
    [items, reviewed],
  );
  const todo = useMemo(
    () => applyFilters(unreviewed, facets, filters.state),
    [unreviewed, filters.state],
  );

  if (status === "failed")
    return <LoadError what="the cards" onRetry={retry} />;
  if (reviewsFailed)
    return (
      <LoadError what="your reviews" onRetry={() => setAttempt((n) => n + 1)} />
    );
  if (status !== "loaded") return <Loading label="Loading the cards" />;
  if (!reviewed) return <Loading label="Loading your reviews" />;
  const classCards = todo.filter(isClassCard);
  const generics = todo.filter((c) => !isClassCard(c));

  // The pop-over steps through the list in the order shown.
  const stops = [...classCards, ...generics];
  const open = search.card
    ? items.find((c) => c.id === search.card)
    : undefined;
  const at = open ? stops.findIndex((c) => c.id === open.id) : -1;
  const goTo = (cardId: string | undefined) =>
    void navigate({
      to: ".",
      replace: true,
      resetScroll: false,
      search: (prev: ListSearch) => ({
        ...prev,
        card: cardId,
        variant: undefined,
      }),
    });
  // After a review the card is done: drop it from the list and move on (or close at the end).
  const reviewedAndNext = () => {
    if (!open) return;
    const next = stops.slice(at + 1)[0] ?? stops.slice(0, at)[0];
    setReviewed(new Set(reviewed).add(open.id));
    goTo(next?.id);
  };

  return (
    <>
      {open && (
        <CardModal
          cardId={open.id}
          name={open.name}
          verified={open.attributesVerified}
          position={
            at >= 0 ? { index: at + 1, total: stops.length } : undefined
          }
          onPrevious={at > 0 ? () => goTo(stops[at - 1]!.id) : undefined}
          onNext={
            at >= 0 && stops[at + 1] ? () => goTo(stops[at + 1]!.id) : undefined
          }
          onNextCard={reviewedAndNext}
          onClose={() => goTo(undefined)}
        />
      )}
      <h1>Needs review</h1>
      {unreviewed.length === 0 ? (
        <p className={styles.allDone}>You've reviewed every card. Thank you.</p>
      ) : (
        <div className={styles.intro}>
          <p>
            {todo.length} {todo.length === 1 ? "card" : "cards"} left to review
          </p>
          {stops.length > 0 && (
            <>
              {/* The fast way: one key per card. Start reviewing opens the full view. */}
              <Link
                to="/needs-review/quick"
                className={`${ui.button} ${ui.primary}`}
              >
                Quick review
              </Link>
              <Button onClick={() => goTo(stops[0]!.id)}>
                Start reviewing
              </Button>
            </>
          )}
        </div>
      )}
      <p className={styles.synergies}>
        Check the links the rules suggest between cards:{" "}
        <Link to="/needs-review/synergies">Confirm synergies</Link>
      </p>
      <p className={styles.synergies}>
        Check what the rules engine drafts from each card's facts:{" "}
        <Link to="/needs-review/effects">Check effect drafts</Link>
      </p>
      <FilteredLayout
        state={filters.state}
        facets={facets}
        onClear={() => filters.setState({})}
        bar={
          <FilterBar
            items={unreviewed}
            facets={facets}
            state={filters.state}
            onChange={filters.setState}
          />
        }
        sidebar={
          <FilterSidebar
            items={unreviewed}
            facets={facets}
            state={filters.state}
            onChange={filters.setState}
          />
        }
      >
        <Section title="Runeblade and Shadow" cards={classCards} />
        <Section title="Generic" cards={generics} />
      </FilteredLayout>
    </>
  );
}
