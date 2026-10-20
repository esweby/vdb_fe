// A deck's owner can make it public or private, rename it, and delete it after confirming (the
// maintainer, 20 Oct 2026).
import { useState, type FormEvent } from "react";
import { useServices } from "../servicesContext.ts";
import { Button, Dialog, Tag, TextField } from "../ui/index.ts";
import styles from "./Decks.module.css";

export function DeckSettings(props: {
  deck: { id: string; name: string; isPublic: boolean };
  /** The deck as it now is, after a change saved. */
  onChange: (patch: { name?: string; isPublic?: boolean }) => void;
  onDeleted: () => void;
}) {
  const { decks } = useServices();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(props.deck.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleVisibility() {
    const isPublic = !props.deck.isPublic;
    try {
      await decks.setVisibility(props.deck.id, isPublic);
      props.onChange({ isPublic });
      setError(null);
    } catch {
      setError("Couldn't change who can see the deck.");
    }
  }

  async function rename(e: FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (!next) return setNameError("A deck needs a name.");
    if (next.length > 80) return setNameError("Keep it to 80 characters.");
    try {
      await decks.renameDeck(props.deck.id, next);
      props.onChange({ name: next });
      setRenaming(false);
      setNameError(null);
    } catch {
      setNameError("Couldn't rename the deck.");
    }
  }

  async function remove() {
    try {
      await decks.deleteDeck(props.deck.id);
      setConfirming(false);
      props.onDeleted();
    } catch {
      setConfirming(false);
      setError("Couldn't delete the deck.");
    }
  }

  return (
    <div className={styles.deckSettings}>
      <Tag tone={props.deck.isPublic ? "accent" : "neutral"}>
        {props.deck.isPublic ? "Public" : "Private"}
      </Tag>
      <Button variant="ghost" onClick={() => void toggleVisibility()}>
        {props.deck.isPublic ? "Make private" : "Make public"}
      </Button>
      {renaming ? (
        <form className={styles.renameForm} onSubmit={(e) => void rename(e)}>
          <TextField
            label="Deck name"
            hideLabel
            value={name}
            maxLength={80}
            error={nameError}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
          />
          <Button type="submit" variant="primary">
            Save name
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setRenaming(false);
              setName(props.deck.name);
              setNameError(null);
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          variant="ghost"
          onClick={() => {
            setName(props.deck.name);
            setRenaming(true);
          }}
        >
          Rename
        </Button>
      )}
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Delete deck
      </Button>
      {error && <p role="alert">{error}</p>}
      <Dialog
        title={`Delete ${props.deck.name}?`}
        open={confirming}
        onClose={() => setConfirming(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button variant="primary" onClick={() => void remove()}>
              Delete it
            </Button>
          </>
        }
      >
        <p>
          This deletes the deck, its cards, matchup plans and scenario results.
          It can&apos;t be undone.
        </p>
      </Dialog>
    </div>
  );
}
