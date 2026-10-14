import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServices } from "../servicesContext.ts";
import { Button, TextField } from "../ui/index.ts";
import type { DeckSummary } from "./deckRepository.ts";
import styles from "./Decks.module.css";

export function DecksPage() {
  const { decks } = useServices();
  const navigate = useNavigate();
  const [list, setList] = useState<DeckSummary[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    decks.listDecks().then(
      (d) => live && setList(d),
      (e) => live && setError(String(e.message ?? e)),
    );
    return () => {
      live = false;
    };
  }, [decks]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const deck = await decks.createDeck(name.trim());
      await navigate({ to: "/decks/$deckId", params: { deckId: deck.id } });
    } catch (err) {
      setError(
        `Couldn't create the deck: ${err instanceof Error ? err.message : String(err)}`,
      );
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Decks</h1>
      {error && <p role="alert">{error}</p>}
      <form className={styles.create} onSubmit={(e) => void create(e)}>
        <TextField
          label="New deck name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          Create deck
        </Button>
      </form>
      {list === null ? (
        <p>Loading…</p>
      ) : list.length === 0 ? (
        <p className={styles.muted}>No decks yet.</p>
      ) : (
        <ul className={styles.deckList}>
          {list.map((d) => (
            <li key={d.id}>
              <Link to="/decks/$deckId" params={{ deckId: d.id }}>
                {d.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
