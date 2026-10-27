// A deck's owner can set who sees it (private, link only or public; the maintainer, 27 Oct 2026),
// rename it, and delete it after confirming (the maintainer, 20 Oct 2026). They can also replace
// its cards from a pasted or uploaded list (the maintainer, 27 Oct 2026).
import { useState, type FormEvent } from "react";
import { useServices } from "../servicesContext.ts";
import { Button, Dialog, TextField } from "../ui/index.ts";
import { ImportListDialog } from "./DeckImport.tsx";
import type { DeckCard, Visibility } from "./deckRepository.ts";
import styles from "./Decks.module.css";
import { VISIBILITIES } from "./visibility.ts";

export function DeckSettings(props: {
  deck: { id: string; name: string; visibility: Visibility };
  /** The deck as it now is, after a change saved. */
  onChange: (patch: {
    name?: string;
    visibility?: Visibility;
    cards?: DeckCard[];
  }) => void;
  onDeleted: () => void;
}) {
  const { decks } = useServices();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(props.deck.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [replacing, setReplacing] = useState(false);

  async function changeVisibility(visibility: Visibility) {
    try {
      await decks.setVisibility(props.deck.id, visibility);
      props.onChange({ visibility });
      setError(null);
    } catch {
      setError("Couldn't change who can see the deck.");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/decks/${props.deck.id}`,
      );
      setCopied(true);
    } catch {
      setError("Couldn't copy the link. Copy it from the address bar instead.");
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
      <select
        className={styles.visibilitySelect}
        aria-label="Who can see this deck"
        value={props.deck.visibility}
        onChange={(e) => {
          setCopied(false);
          void changeVisibility(e.target.value as Visibility);
        }}
      >
        {VISIBILITIES.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </select>
      {props.deck.visibility !== "private" && (
        <Button variant="ghost" onClick={() => void copyLink()}>
          Copy link
        </Button>
      )}
      {copied && (
        <span role="status" className={styles.linkCopied}>
          Link copied.
        </span>
      )}
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
      <Button variant="ghost" onClick={() => setReplacing(true)}>
        Replace from list
      </Button>
      {replacing && (
        <ImportListDialog
          mode="replace"
          title={`Replace ${props.deck.name}'s cards`}
          onClose={() => setReplacing(false)}
          onImport={async ({ cards }) => {
            await decks.replaceCards(props.deck.id, cards);
            props.onChange({ cards });
            setReplacing(false);
          }}
        />
      )}
      <Button
        variant="ghost"
        className={styles.deleteDeck}
        onClick={() => setConfirming(true)}
      >
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
          This deletes the deck, its cards, versions, matchup plans and scenario
          results. It can&apos;t be undone.
        </p>
      </Dialog>
    </div>
  );
}
