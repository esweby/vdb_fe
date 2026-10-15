import { useMemo, useState, type FormEvent } from "react";
import { pitchName } from "../cards/pitch.ts";
import type { Deck, PitchTargets } from "../decks/deckRepository.ts";
import { Button } from "../ui/index.ts";
import {
  alternatives,
  suggestCore,
  type CoreCandidate,
  type CorePick,
} from "./suggestCore.ts";
import styles from "./CoreBuilder.module.css";

/**
 * Starting targets when the deck has none, from the example in docs/phase-one.md.
 * UNVERIFIED: for the scoring group to confirm.
 */
export const EXAMPLE_TARGETS: PitchTargets = { 1: 18, 2: 5, 3: 22 };
const PITCHES = [1, 2, 3] as const;

export type NamedCandidate = CoreCandidate & { name: string };

/**
 * Builds a core to pitch targets from the ranking, then lets you edit it: change copies,
 * lock, swap for the next best of the same pitch, or remove. Locked cards survive changes
 * to the targets; removed cards stay out.
 */
export function CoreBuilder(props: {
  ranked: NamedCandidate[];
  copyLimit: number;
  /** Pinned cards and cards already in the deck start locked. */
  initialLocked: Map<string, number>;
  deck: Deck | null;
  signedIn: boolean;
  onAddToDeck: (picks: CorePick[]) => Promise<void>;
  onSaveAsDeck: (name: string, picks: CorePick[]) => Promise<void>;
  onClose: () => void;
}) {
  const deckTargets = props.deck?.pitchTargets ?? {};
  const [targets, setTargets] = useState<PitchTargets>(
    Object.keys(deckTargets).length > 0 ? deckTargets : EXAMPLE_TARGETS,
  );
  const [copiesEach, setCopiesEach] = useState(props.copyLimit);
  const [locked, setLocked] = useState(props.initialLocked);
  const [removed, setRemoved] = useState(new Set<string>());
  const [swapping, setSwapping] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const constraints = {
    targets,
    copiesEach,
    copyLimit: props.copyLimit,
    locked,
    removed,
  };
  const suggestion = useMemo(
    () => suggestCore(props.ranked, constraints),
    [props.ranked, targets, copiesEach, props.copyLimit, locked, removed],
  );
  const nameOf = (variantId: string) =>
    props.ranked.find((r) => r.variantId === variantId)?.name ?? "";
  const total = suggestion.picks.reduce((n, p) => n + p.quantity, 0);

  const lock = (variantId: string, quantity: number) =>
    setLocked(new Map(locked).set(variantId, quantity));
  const unlock = (variantId: string) => {
    const next = new Map(locked);
    next.delete(variantId);
    setLocked(next);
  };
  const remove = (variantId: string) => {
    unlock(variantId);
    setRemoved(new Set(removed).add(variantId));
  };
  const setCopies = (p: CorePick, quantity: number) =>
    quantity <= 0 ? remove(p.variantId) : lock(p.variantId, quantity);
  const swap = (p: CorePick, to: string) => {
    const next = new Map(locked);
    next.delete(p.variantId);
    next.set(to, p.quantity);
    setLocked(next);
    setRemoved(new Set(removed).add(p.variantId));
    setSwapping(null);
  };

  async function save(action: () => Promise<void>, done: string) {
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
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
      () => props.onSaveAsDeck(name.trim(), suggestion.picks),
      `Saved as ${name.trim()}`,
    );
  }

  const groups = [...PITCHES, null].map((pitch) => ({
    pitch,
    picks: suggestion.picks.filter((p) =>
      pitch === null ? !PITCHES.includes(p.pitch as 1) : p.pitch === pitch,
    ),
  }));

  return (
    <section className={styles.panel} aria-label="Build a core">
      <header className={styles.header}>
        <h2>Build a core</h2>
        <Button
          variant="ghost"
          aria-label="Close the core builder"
          onClick={props.onClose}
        >
          ✕
        </Button>
      </header>

      <fieldset className={styles.targets}>
        <legend>Pitch targets (copies)</legend>
        {PITCHES.map((pitch) => (
          <label key={pitch} className={styles[`pitch${pitch}`]}>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.visuallyHidden}>
              {pitchName(pitch)} target
            </span>
            <span aria-hidden="true">{pitchName(pitch)}</span>
            <input
              type="number"
              min={0}
              max={80}
              value={targets[pitch] ?? 0}
              onChange={(e) =>
                setTargets({
                  ...targets,
                  [pitch]: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </label>
        ))}
      </fieldset>

      <div className={styles.copies}>
        <span className={styles.label}>Copies of each card</span>
        <div
          className={styles.presets}
          role="group"
          aria-label="Copies of each card"
        >
          {Array.from({ length: props.copyLimit }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={copiesEach === n}
              onClick={() => setCopiesEach(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <ul className={styles.summary}>
        {suggestion.byPitch.map((b) => {
          const gap = b.target - b.filled;
          return (
            <li
              key={b.pitch}
              className={`${styles[`pitch${b.pitch}`]} ${gap > 0 ? styles.short : ""}`}
            >
              <span className={styles.dot} aria-hidden="true" />
              <span>
                {pitchName(b.pitch)} {b.filled} of {b.target}
                {gap > 0 && ` · ${gap} short`}
                {gap < 0 && ` · ${-gap} over`}
              </span>
            </li>
          );
        })}
        <li className={styles.total}>{total} cards</li>
      </ul>

      <div className={styles.picks}>
        {groups
          .filter((g) => g.picks.length > 0)
          .map((g) => (
            <div key={String(g.pitch)}>
              <h3 className={styles.groupTitle}>{pitchName(g.pitch)}</h3>
              <ul>
                {g.picks.map((p) => {
                  const n = nameOf(p.variantId);
                  const options =
                    swapping === p.variantId
                      ? alternatives(
                          props.ranked,
                          suggestion,
                          constraints,
                          p.variantId,
                        )
                      : [];
                  return (
                    <li
                      key={p.variantId}
                      aria-label={`${p.quantity} × ${n}`}
                      className={styles.pick}
                    >
                      <div className={styles.pickRow}>
                        <span className={styles.stepper}>
                          <button
                            type="button"
                            aria-label={`Fewer ${n}`}
                            onClick={() => setCopies(p, p.quantity - 1)}
                          >
                            −
                          </button>
                          <span>{p.quantity}</span>
                          <button
                            type="button"
                            aria-label={`More ${n}`}
                            disabled={p.quantity >= props.copyLimit}
                            onClick={() => setCopies(p, p.quantity + 1)}
                          >
                            +
                          </button>
                        </span>
                        <span className={styles.pickName}>{n}</span>
                        <span className={styles.value}>
                          {Math.round(p.value)}
                        </span>
                        <span className={styles.pickActions}>
                          <button
                            type="button"
                            aria-label={`${p.locked ? "Unlock" : "Lock"} ${n}`}
                            title={
                              p.locked
                                ? "Locked: kept when targets change"
                                : "Lock"
                            }
                            data-on={p.locked || undefined}
                            onClick={() =>
                              p.locked
                                ? unlock(p.variantId)
                                : lock(p.variantId, p.quantity)
                            }
                          >
                            {p.locked ? "Locked" : "Lock"}
                          </button>
                          <button
                            type="button"
                            aria-label={`Swap ${n}`}
                            aria-expanded={swapping === p.variantId}
                            onClick={() =>
                              setSwapping(
                                swapping === p.variantId ? null : p.variantId,
                              )
                            }
                          >
                            Swap
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${n}`}
                            onClick={() => remove(p.variantId)}
                          >
                            ✕
                          </button>
                        </span>
                      </div>
                      {swapping === p.variantId && (
                        <div className={styles.swap}>
                          {options.length === 0 ? (
                            <span className={styles.muted}>
                              No other {pitchName(p.pitch).toLowerCase()} cards
                              ranked.
                            </span>
                          ) : (
                            options.map((o) => (
                              <button
                                key={o.variantId}
                                type="button"
                                aria-label={`Use ${o.name} instead`}
                                onClick={() => swap(p, o.variantId)}
                              >
                                {o.name}{" "}
                                <span className={styles.muted}>
                                  {Math.round(o.value)}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        {suggestion.picks.length === 0 && (
          <p className={styles.muted}>
            Set a pitch target to fill the core from the ranking.
          </p>
        )}
      </div>

      {removed.size > 0 && (
        <p className={styles.muted}>
          {removed.size} removed ·{" "}
          <button
            type="button"
            className={styles.link}
            onClick={() => setRemoved(new Set())}
          >
            Bring them back
          </button>
        </p>
      )}

      <footer className={styles.footer}>
        {!props.signedIn ? (
          <p className={styles.muted}>Sign in to save the core as a deck.</p>
        ) : (
          <>
            {props.deck && (
              <Button
                variant="primary"
                disabled={total === 0}
                onClick={() =>
                  void save(
                    () => props.onAddToDeck(suggestion.picks),
                    `Added ${total} cards to ${props.deck!.name}`,
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
        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </footer>
    </section>
  );
}
