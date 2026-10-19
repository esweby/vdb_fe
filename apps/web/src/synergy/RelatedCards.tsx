import { useEffect, useId, useState, type FormEvent } from "react";
import { useCards } from "../cards/useCards.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { Button, TextField } from "../ui/index.ts";
import styles from "./RelatedCards.module.css";
import type { LinkRow } from "./synergyRepository.ts";

/**
 * Related cards (README "Synergy graph"): the scorer's own "this card helps…" and "is helped
 * by…" links, for links no rule makes or that the rules get wrong. They count toward the
 * scoring group's links once 2 or more scorers agree (docs/synergy-rules.md).
 */
export function RelatedCards(props: { cardId: string }) {
  const { synergy } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const { items } = useCards();
  const listId = useId();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [direction, setDirection] = useState<"helps" | "helped">("helps");
  const [cardName, setCardName] = useState("");
  const [weight, setWeight] = useState("0.5");
  const [note, setNote] = useState("");
  const [bothWays, setBothWays] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    synergy.listMyLinks(user.id, props.cardId).then(
      (l) => live && setLinks(l),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [synergy, user, props.cardId]);

  if (!user) return null;
  const nameOf = (id: string) => items.find((c) => c.id === id)?.name ?? id;
  const helps = links.filter((l) => l.fromCardId === props.cardId);
  const helpedBy = links.filter((l) => l.toCardId === props.cardId);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const other = items.find(
      (c) => c.name.toLowerCase() === cardName.trim().toLowerCase(),
    );
    if (!other) return setError("Pick a card from the list.");
    if (other.id === props.cardId) return setError("A card can't help itself.");
    const w = Number(weight);
    if (weight.trim() === "" || !Number.isFinite(w) || w < 0 || w > 1)
      return setError("How much is from 0 to 1.");
    const from = direction === "helps" ? props.cardId : other.id;
    const to = direction === "helps" ? other.id : props.cardId;
    const base = {
      weight: Math.round(w * 100) / 100,
      note: note.trim() || null,
    };
    const rows: LinkRow[] = [{ fromCardId: from, toCardId: to, ...base }];
    if (bothWays) rows.push({ fromCardId: to, toCardId: from, ...base });
    try {
      await synergy.saveLinks(user.id, rows);
      const keys = new Set(rows.map((r) => `${r.fromCardId}→${r.toCardId}`));
      setLinks((l) => [
        ...l.filter((x) => !keys.has(`${x.fromCardId}→${x.toCardId}`)),
        ...rows,
      ]);
      setCardName("");
      setNote("");
      setBothWays(false);
      setError(null);
    } catch (err) {
      setError(
        `Couldn't save: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async function remove(link: LinkRow) {
    if (!user) return;
    try {
      await synergy.removeLink(user.id, link.fromCardId, link.toCardId);
      setLinks((l) =>
        l.filter(
          (x) =>
            x.fromCardId !== link.fromCardId || x.toCardId !== link.toCardId,
        ),
      );
    } catch (err) {
      setError(
        `Couldn't remove: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const linkList = (
    label: "Helps" | "Is helped by",
    rows: LinkRow[],
    otherOf: (l: LinkRow) => string,
  ) => (
    <div className={styles.group}>
      <h3>{label}</h3>
      <ul aria-label={label} className={styles.list}>
        {rows.map((l) => (
          <li key={`${l.fromCardId}→${l.toCardId}`}>
            <span>
              {nameOf(otherOf(l))} {l.weight}
              {l.note && ` · ${l.note}`}
            </span>
            <button
              type="button"
              className={styles.remove}
              aria-label={`Remove ${nameOf(otherOf(l))}`}
              onClick={() => void remove(l)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className={styles.muted}>None yet.</p>}
    </div>
  );

  return (
    <section aria-label="Related cards" className={styles.related}>
      <h2>Related cards</h2>
      <p className={styles.muted}>
        Your own links, for synergies the rules miss. They count once two or
        more scorers agree.
      </p>
      {linkList("Helps", helps, (l) => l.toCardId)}
      {linkList("Is helped by", helpedBy, (l) => l.fromCardId)}

      <form className={styles.form} onSubmit={(e) => void add(e)}>
        <label className={styles.field}>
          <span>Direction</span>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as typeof direction)}
          >
            <option value="helps">Helps</option>
            <option value="helped">Is helped by</option>
          </select>
        </label>
        <TextField
          label="Card"
          list={listId}
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          autoComplete="off"
        />
        <datalist id={listId}>
          {items
            .filter((c) => c.id !== props.cardId)
            .map((c) => (
              <option key={c.id} value={c.name} />
            ))}
        </datalist>
        <TextField
          label="How much (0 to 1)"
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <TextField
          label="Note (optional)"
          maxLength={280}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={bothWays}
            onChange={(e) => setBothWays(e.target.checked)}
          />
          Works both ways
        </label>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <Button type="submit">Add link</Button>
      </form>
    </section>
  );
}
