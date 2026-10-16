import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { Deck, DeckSummary } from "../decks/deckRepository.ts";
import { Button } from "../ui/index.ts";
import type { CoreCard } from "./engines.ts";
import styles from "./RankingPage.module.css";

export interface TrayCard extends CoreCard {
  variantId: string;
  label: string;
  pitch: number | null;
  value: number;
}

/** The core beside the board: its cards with their copies, and saving to a deck. */
export function CoreRail(props: {
  cards: TrayCard[];
  copyLimit: number;
  onQuantity: (variantId: string, quantity: number) => void;
  signedIn: boolean;
  deck: Deck | null;
  deckId?: string;
  deckList: DeckSummary[];
  onChooseDeck: (deckId: string | undefined) => void;
  onAddToDeck: () => Promise<void>;
  /** Saves the core as a new deck, returning it. */
  onSaveAsDeck: (name: string) => Promise<{ id: string; name: string }>;
}) {
  const [name, setName] = useState("");
  // What was saved, and the deck it went to, so the next step is one click away.
  const [message, setMessage] = useState<{
    text: string;
    deck: { id: string; name: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const total = props.cards.reduce((n, c) => n + c.quantity, 0);
  const sorted = [...props.cards].sort(
    (a, b) => (a.pitch ?? 9) - (b.pitch ?? 9) || b.value - a.value,
  );

  async function save(
    action: () => Promise<{ id: string; name: string }>,
    done: (deck: { name: string }) => string,
  ) {
    setError(null);
    setMessage(null);
    try {
      const deck = await action();
      setMessage({ text: done(deck), deck });
    } catch (e) {
      setError(
        `Couldn't save the core: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  function saveAsDeck(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name the deck first.");
    void save(
      () => props.onSaveAsDeck(name.trim()),
      (deck) => `Saved as ${deck.name}`,
    );
  }

  return (
    <section className={styles.tray} aria-label="Your core">
      <header className={styles.trayHead}>
        <h2>Your core</h2>
        <span className={styles.railCount}>{total} cards</span>
      </header>

      <div className={styles.trayBody}>
        <div className={styles.traySection}>
          <h3 className={styles.label}>Cards</h3>
          {sorted.length === 0 && (
            <p className={styles.none}>
              Add cards from the board with +, or fill to your targets.
            </p>
          )}
          <ul aria-label="Cards in your core" className={styles.coreList}>
            {sorted.map((c) => (
              <li
                key={c.variantId}
                aria-label={`${c.quantity} × ${c.label}`}
                style={{
                  ["--pitch" as string]: `var(--pitch-${c.pitch ?? 0})`,
                }}
              >
                <span className={styles.pitchDot} aria-hidden="true" />
                <span className={styles.coreName}>{c.label}</span>
                <span className={styles.stepper}>
                  <button
                    type="button"
                    aria-label={`Fewer ${c.label}`}
                    onClick={() =>
                      props.onQuantity(c.variantId, c.quantity - 1)
                    }
                  >
                    −
                  </button>
                  <span>{c.quantity}</span>
                  <button
                    type="button"
                    aria-label={`More ${c.label}`}
                    disabled={c.quantity >= props.copyLimit}
                    onClick={() =>
                      props.onQuantity(c.variantId, c.quantity + 1)
                    }
                  >
                    +
                  </button>
                </span>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove ${c.label}`}
                  onClick={() => props.onQuantity(c.variantId, 0)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className={styles.trayFoot}>
        {!props.signedIn ? (
          <p className={styles.none}>Sign in to save the core as a deck.</p>
        ) : (
          <>
            <label className={styles.deckPick}>
              <span className={styles.label}>Deck</span>
              <select
                value={props.deckId ?? ""}
                onChange={(e) =>
                  props.onChooseDeck(e.target.value || undefined)
                }
              >
                <option value="">None</option>
                {props.deckList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {props.deck && (
              <Button
                variant="primary"
                disabled={total === 0}
                onClick={() =>
                  void save(
                    async () => {
                      await props.onAddToDeck();
                      return props.deck!;
                    },
                    (deck) => `Added ${total} cards to ${deck.name}`,
                  )
                }
              >
                Add core to {props.deck.name}
              </Button>
            )}
            <form className={styles.newDeck} onSubmit={saveAsDeck}>
              <input
                type="text"
                aria-label="New deck name"
                maxLength={80}
                placeholder="New deck name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
              />
              <Button type="submit" disabled={total === 0}>
                Save as new deck
              </Button>
            </form>
          </>
        )}
        {message && (
          <p role="status" className={styles.saved}>
            <span>{message.text}</span> ·{" "}
            <Link to="/decks/$deckId" params={{ deckId: message.deck.id }}>
              Open {message.deck.name}
            </Link>
          </p>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </footer>
    </section>
  );
}
