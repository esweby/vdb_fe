// Deck list import (the maintainer, 27 Oct 2026): paste a list or upload a .txt or .csv file,
// for a new deck or to replace a deck's pool. Lines that don't match a card are listed to fix
// or remove; nothing imports until every line matches. Deck rules aren't checked here.
import { useId, useMemo, useState, type FormEvent } from "react";
import { useCards } from "../cards/useCards.ts";
import { Button, Dialog, TextField } from "../ui/index.ts";
import { matchDeckList, removeLine } from "./deckImport.ts";
import styles from "./DeckImport.module.css";
import { readDeckList } from "./deckList.ts";
import type { DeckCard, Visibility } from "./deckRepository.ts";
import { VISIBILITIES } from "./visibility.ts";

export interface ImportedList {
  name: string;
  visibility: Visibility;
  cards: DeckCard[];
}

/** A file's text, read with FileReader (works where Blob.text() doesn't). */
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

const lines = (n: number) => `${n} ${n === 1 ? "line" : "lines"}`;

export function ImportListDialog(props: {
  /** New deck: asks for a name and who can see it. Replace: the deck's pool is replaced. */
  mode: "create" | "replace";
  title: string;
  onClose: () => void;
  onImport: (list: ImportedList) => Promise<void>;
}) {
  const { items, status } = useCards();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listId = useId();
  const fileId = useId();
  const whoId = useId();

  const list = useMemo(() => readDeckList(text), [text]);
  const matched = useMemo(() => matchDeckList(list, items), [list, items]);
  const total = list.cards.length + list.unreadable.length;
  const creating = props.mode === "create";

  function changeText(next: string) {
    setText(next);
    setError(null);
    // A FaBrary export names the deck; use it unless a name has been typed.
    const named = readDeckList(next).name;
    if (creating && !nameTouched && named) setName(named.slice(0, 80));
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      changeText(await readFile(file));
    } catch {
      setError("Couldn't read that file.");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (creating && !name.trim()) return setNameError("Name the deck first.");
    if (!matched.ready) return;
    setBusy(true);
    try {
      await props.onImport({
        name: name.trim(),
        visibility,
        cards: matched.cards,
      });
    } catch (err) {
      setError(
        `Couldn't import the list: ${err instanceof Error ? err.message : String(err)}`,
      );
      setBusy(false);
    }
  }

  return (
    <Dialog title={props.title} open onClose={props.onClose} wide>
      <form className={styles.form} onSubmit={(e) => void submit(e)}>
        {creating ? (
          <div className={styles.details}>
            <TextField
              label="Deck name"
              maxLength={80}
              value={name}
              error={nameError}
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
                setNameError(null);
              }}
            />
            <div className={styles.who}>
              <label htmlFor={whoId}>Who can see it</label>
              <select
                id={whoId}
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as Visibility)}
              >
                {VISIBILITIES.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <p className={styles.note}>
            This replaces every card in the deck and the sideboard. Matchup
            plans keep only the cards still in the pool.
          </p>
        )}

        <div className={styles.columns}>
          <div className={styles.source}>
            <label htmlFor={listId}>Deck list</label>
            <textarea
              id={listId}
              className={styles.text}
              value={text}
              rows={14}
              spellCheck={false}
              placeholder={
                "3x Hocus Pocus (red)\n1 Nebula Blade\n\nSideboard\n2 Hocus Pocus (blue)"
              }
              aria-describedby={`${listId}-hint`}
              onChange={(e) => changeText(e.target.value)}
            />
            <small id={`${listId}-hint`} className={styles.hint}>
              One card per line, like “3x Hocus Pocus (red)”. Cards after a
              Sideboard heading go in the sideboard. A FaBrary export works too.
            </small>
            <label htmlFor={fileId} className={styles.fileLabel}>
              Or upload a .txt or .csv file
            </label>
            <input
              id={fileId}
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </div>

          <div className={styles.check} aria-live="polite">
            {status === "loading" && items.length === 0 ? (
              <p className={styles.note}>Loading cards…</p>
            ) : total === 0 ? (
              <p className={styles.note}>
                Paste a list or upload a file to check it here.
              </p>
            ) : (
              <>
                <p className={styles.summary}>
                  {lines(total - matched.unmatched.length)} matched.
                  {matched.unmatched.length > 0 &&
                    ` ${lines(matched.unmatched.length)} to fix or remove.`}
                </p>
                {matched.hero && (
                  <p className={styles.warning}>{matched.hero}</p>
                )}
                {matched.unmatched.length > 0 && (
                  <ul className={styles.problems} aria-label="Lines to fix">
                    {matched.unmatched.map((u) => (
                      <li key={u.line}>
                        <div>
                          <span className={styles.lineNo}>Line {u.line}</span>{" "}
                          <code>{u.text}</code>
                          <span className={styles.reason}>{u.reason}</span>
                        </div>
                        <Button
                          variant="ghost"
                          aria-label={`Remove line ${u.line}: ${u.text}`}
                          onClick={() => changeText(removeLine(text, u.line))}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>

        {error && <p role="alert">{error}</p>}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !matched.ready}
          >
            {creating ? "Create deck" : "Replace cards"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
