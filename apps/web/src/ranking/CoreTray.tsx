import { useState, type FormEvent } from "react";
import { pitchName } from "../cards/pitch.ts";
import type {
  Deck,
  DeckSummary,
  PitchTargets,
} from "../decks/deckRepository.ts";
import { Button, Slider } from "../ui/index.ts";
import { balance, ENGINES, type CoreCard } from "./engines.ts";
import { RISK_PRESETS, type RankingSettings } from "./rankingSearch.ts";
import styles from "./RankingPage.module.css";

const PITCHES = [1, 2, 3] as const;
const SIDE_PRESETS = [
  { label: "Forsaken", value: 0 },
  { label: "Both", value: 50 },
  { label: "Usurper", value: 100 },
];
const SOURCE_PRESETS = [
  { label: "Mine", value: 0 },
  { label: "Blend", value: 50 },
  { label: "Community", value: 100 },
];

export interface TrayCard extends CoreCard {
  variantId: string;
  label: string;
  pitch: number | null;
  value: number;
}

function Presets(props: {
  label: string;
  options: readonly { label: string; value: number }[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className={styles.presets} role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o.label}
          type="button"
          aria-pressed={props.value === o.value}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The core being built: the priorities that rank the board, pitch against targets, how each
 * engine balances, the cards with their copies, and saving to a deck.
 */
export function CoreTray(props: {
  settings: RankingSettings;
  onSettings: (patch: Partial<RankingSettings>) => void;
  showBlend: boolean;
  cards: TrayCard[];
  copyLimit: number;
  deckMin?: number;
  targets: PitchTargets;
  onTargets: (targets: PitchTargets) => void;
  onQuantity: (variantId: string, quantity: number) => void;
  onFill: () => void;
  signedIn: boolean;
  deck: Deck | null;
  deckId?: string;
  deckList: DeckSummary[];
  onChooseDeck: (deckId: string | undefined) => void;
  onAddToDeck: () => Promise<void>;
  onSaveAsDeck: (name: string) => Promise<void>;
}) {
  const { settings } = props;
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const total = props.cards.reduce((n, c) => n + c.quantity, 0);
  const sorted = [...props.cards].sort(
    (a, b) => (a.pitch ?? 9) - (b.pitch ?? 9) || b.value - a.value,
  );

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
    void save(() => props.onSaveAsDeck(name.trim()), `Saved as ${name.trim()}`);
  }

  return (
    <section className={styles.tray} aria-label="Your core">
      <header className={styles.trayHead}>
        <h2>Your core</h2>
        <span className={styles.total}>
          {props.deckMin
            ? `${total} of ${props.deckMin} deck cards`
            : `${total} deck cards`}
        </span>
      </header>

      <div className={styles.trayBody}>
        <div className={styles.traySection}>
          <h3 className={styles.label}>Play style</h3>
          <Presets
            label="Play style"
            options={RISK_PRESETS.map((p) => ({
              label: p.label,
              value: p.risk,
            }))}
            value={settings.risk}
            onChange={(risk) => props.onSettings({ risk })}
          />
          <Slider
            label="Risk (floor ← → ceiling)"
            visibleLabel={null}
            noScale
            min={-100}
            max={100}
            step={10}
            value={settings.risk}
            onChange={(risk) => props.onSettings({ risk })}
          />
          <span className={styles.ends} aria-hidden="true">
            <span>Floor</span>
            <span>Ceiling</span>
          </span>
        </div>
        <div className={styles.traySection}>
          <h3 className={styles.label}>Side</h3>
          <Presets
            label="Side"
            options={SIDE_PRESETS}
            value={settings.sideFocus}
            onChange={(sideFocus) => props.onSettings({ sideFocus })}
          />
        </div>
        {props.showBlend && (
          <div className={styles.traySection}>
            <h3 className={styles.label}>Whose scores</h3>
            <Presets
              label="Whose scores"
              options={SOURCE_PRESETS}
              value={settings.sourceBlend}
              onChange={(sourceBlend) => props.onSettings({ sourceBlend })}
            />
          </div>
        )}

        <div className={styles.traySection}>
          <h3 className={styles.label}>Pitch against targets</h3>
          {PITCHES.map((pitch) => {
            const n = props.cards
              .filter((c) => c.pitch === pitch)
              .reduce((s, c) => s + c.quantity, 0);
            const target = props.targets[pitch] ?? 0;
            return (
              <div
                key={pitch}
                className={styles.meter}
                style={{ ["--pitch" as string]: `var(--pitch-${pitch})` }}
              >
                <span>
                  {pitchName(pitch)} {n} of {target}
                </span>
                <span className={styles.bar}>
                  <i
                    style={{
                      width: `${target ? Math.min(100, (n / target) * 100) : 0}%`,
                    }}
                  />
                </span>
                <input
                  type="number"
                  min={0}
                  max={80}
                  aria-label={`${pitchName(pitch)} target`}
                  value={target}
                  onChange={(e) =>
                    props.onTargets({
                      ...props.targets,
                      [pitch]: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </div>
            );
          })}
          <Button onClick={props.onFill}>Fill to targets</Button>
        </div>

        <div className={styles.traySection}>
          <h3 className={styles.label}>Engines</h3>
          {ENGINES.map((e) => {
            const b = balance(props.cards, e.id);
            const gap =
              b.generators > 0 && b.payoffs === 0
                ? e.noPayoffs
                : b.payoffs > 0 && b.generators === 0
                  ? e.noGenerators
                  : null;
            return (
              <div
                key={e.id}
                role="group"
                aria-label={e.name}
                className={styles.balance}
              >
                <span className={styles.balanceName}>{e.name}</span>
                <span className={styles.balanceRow}>
                  <span>
                    {b.generators} {e.makeWord}
                  </span>
                  <span className={styles.pips} aria-hidden="true">
                    {Array.from(
                      { length: Math.min(b.generators, 12) },
                      (_, i) => (
                        <i key={`g${i}`} />
                      ),
                    )}
                    <span className={styles.pipGap} />
                    {Array.from({ length: Math.min(b.payoffs, 12) }, (_, i) => (
                      <i key={`p${i}`} data-payoff="" />
                    ))}
                  </span>
                  <span>
                    {b.payoffs} {e.useWord}
                  </span>
                </span>
                {gap && <span className={styles.gap}>{gap}</span>}
              </div>
            );
          })}
        </div>

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
                    props.onAddToDeck,
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
