import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { selectCanScore } from "../auth/authSlice.ts";
import { useCards } from "../cards/useCards.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import ui from "../ui/ui.module.css";
import { SynergyNudge } from "../synergy/SynergyNudge.tsx";
import styles from "./HomePage.module.css";

const button = (variant: "primary" | "secondary") =>
  [ui.button, ui[variant], styles.cta].filter(Boolean).join(" ");

/** What the app is, and the next step for whoever is here. */
export function HomePage() {
  const user = useAppSelector((s) => s.auth.user);
  const canScore = useAppSelector(selectCanScore);
  const { status, items } = useCards();
  const { scores } = useServices();
  const [reviewed, setReviewed] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !canScore) return;
    let live = true;
    scores.listMyReviewedCardIds(user.id).then(
      (ids) => live && setReviewed(ids.length),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [scores, user, canScore]);

  const left =
    status === "loaded" && reviewed !== null
      ? Math.max(0, items.length - reviewed)
      : null;

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <h1>Viserai Deck Builder</h1>
        <p className={styles.lead}>
          Score cards with your group, then build Viserai decks around his
          engines: Runechants, Gates, banish and Usurp. See which cards fit
          together, and run scenarios to check what a core can do.
        </p>
        <div className={styles.actions}>
          {!user && (
            <>
              <Link
                to="/sign-in"
                search={{ mode: "signup" }}
                className={button("primary")}
              >
                Create an account
              </Link>
              <Link to="/sign-in" className={button("secondary")}>
                Sign in
              </Link>
            </>
          )}
          {user && (
            <Link to="/core" className={button("primary")}>
              Build a core
            </Link>
          )}
          <Link to="/cards" className={button("secondary")}>
            Browse the cards
          </Link>
        </div>
      </section>

      {user && canScore && (
        <section className={styles.panel} aria-labelledby="home-reviews">
          <h2 id="home-reviews">Your reviews</h2>
          {left === null ? (
            <p className={styles.muted}>Counting your reviews…</p>
          ) : left === 0 ? (
            <p>You've reviewed every card. Thank you.</p>
          ) : (
            <>
              <p className={styles.big}>
                {`${left.toLocaleString("en-GB")} ${left === 1 ? "card" : "cards"} left to review`}
              </p>
              <p className={styles.muted}>
                Runeblade and Shadow cards come first. Your scores count once
                you mark a card reviewed.
              </p>
              <Link to="/needs-review" className={button("primary")}>
                Continue reviewing
              </Link>
            </>
          )}
        </section>
      )}

      <SynergyNudge />

      <section className={styles.steps} aria-labelledby="home-how">
        <h2 id="home-how">How it works</h2>
        <ol>
          <li>
            <strong>Scorers rate each card</strong>
            <span>
              Floor, overall and ceiling, on each side. A card counts once
              enough scorers have reviewed it.
            </span>
          </li>
          <li>
            <strong>The board ranks cards by engine</strong>
            <span>
              Makers beside what uses them, with your play style and preferences
              deciding the order.
            </span>
          </li>
          <li>
            <strong>You build a core and test it</strong>
            <span>
              Fill to your pitch targets, run scenarios, then save the core to a
              deck.
            </span>
          </li>
        </ol>
      </section>
    </div>
  );
}
