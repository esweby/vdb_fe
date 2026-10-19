import {
  act,
  newGame,
  redo,
  undo,
  type GameAction,
  type GameHistory,
  type GameSetup,
  type Zone,
} from "@vdb/engine";
import { useMemo, useState } from "react";
import { engineCardOf } from "../ranking/scenarios.ts";
import { Button, TextField } from "../ui/index.ts";
import { sectionOf, variantName, type DeckEntry } from "./deckRules.ts";
import styles from "./Goldfish.module.css";

/** Card zones shown as lists; the deck is face down and only counted. */
const ZONE_LABELS: { zone: Zone; label: string }[] = [
  { zone: "hand", label: "Hand" },
  { zone: "arsenal", label: "Arsenal" },
  { zone: "pitch", label: "Pitch" },
  { zone: "arena", label: "Arena" },
  { zone: "graveyard", label: "Graveyard" },
  { zone: "banished", label: "Banished" },
  { zone: "weapons", label: "Weapons" },
  { zone: "equipment", label: "Equipment" },
];
const LABEL = Object.fromEntries(ZONE_LABELS.map((z) => [z.zone, z.label]));

/** What a card can do, from the menu on it: a move, a pitch, or the top or bottom of the deck. */
const CARD_ACTIONS: {
  label: string;
  action: (uid: string) => GameAction;
  zone?: Zone;
}[] = [
  {
    label: "Play",
    zone: "arena",
    action: (uid) => ({ type: "move", uid, to: "arena" }),
  },
  { label: "Pitch", zone: "pitch", action: (uid) => ({ type: "pitch", uid }) },
  {
    label: "Hand",
    zone: "hand",
    action: (uid) => ({ type: "move", uid, to: "hand" }),
  },
  {
    label: "Arsenal",
    zone: "arsenal",
    action: (uid) => ({ type: "move", uid, to: "arsenal" }),
  },
  {
    label: "Graveyard",
    zone: "graveyard",
    action: (uid) => ({ type: "move", uid, to: "graveyard" }),
  },
  {
    label: "Banish",
    zone: "banished",
    action: (uid) => ({ type: "move", uid, to: "banished" }),
  },
  {
    label: "Top of deck",
    action: (uid) => ({ type: "move", uid, to: "deck", position: "top" }),
  },
  {
    label: "Bottom of deck",
    action: (uid) => ({ type: "move", uid, to: "deck", position: "bottom" }),
  },
];

const TOKENS = [
  { token: "runechant", label: "Runechants" },
  { token: "gate", label: "Gates" },
  { token: "eloquence", label: "Eloquence" },
];

const randomSeed = () => Math.floor(Math.random() * 1_000_000);

/**
 * The goldfish tool (README "Goldfishing", phase two step 5): a sandbox for playing a deck's
 * turns alone, on the shared game engine. The user moves every card; the tool keeps count and
 * enforces no game rules. End turn is a helper: pitched cards to the bottom, draw up to 4.
 */
export function Goldfish(props: { entries: DeckEntry[]; seed?: number }) {
  // Each copy, by section: the main deck, then the weapons and equipment in play.
  const { setup, names, images } = useMemo(() => {
    const main = props.entries.filter((e) => !e.sideboard);
    const copies = (section: "deck" | "weapon" | "equipment") =>
      main
        .filter((e) => sectionOf(e.card) === section)
        .flatMap((e) =>
          Array.from({ length: e.quantity }, () =>
            engineCardOf(e.card, e.variant),
          ),
        );
    return {
      setup: {
        deck: copies("deck"),
        weapons: copies("weapon"),
        equipment: copies("equipment"),
      },
      names: new Map(
        main.map((e) => [e.variant.id, variantName(e.card, e.variant)]),
      ),
      images: new Map(main.map((e) => [e.variant.id, e.variant.imageUrl])),
    };
  }, [props.entries]);

  const start = (seed: number, side: GameSetup["side"] = "forsaken") =>
    newGame({ ...setup, seed, side });
  const [seed, setSeed] = useState(() => props.seed ?? randomSeed());
  const [seedInput, setSeedInput] = useState(String(seed));
  const [startSide, setStartSide] = useState<"forsaken" | "usurper">(
    "forsaken",
  );
  const [history, setHistory] = useState<GameHistory>(() => start(seed));
  const g = history.present;
  const doAction = (action: GameAction) => setHistory((h) => act(h, action));
  const nameOf = (id: string) => names.get(id) ?? id;
  const sideName = (side: string) =>
    side === "usurper" ? "Usurper" : "Forsaken";

  function restart(nextSeed = seed) {
    setSeed(nextSeed);
    setSeedInput(String(nextSeed));
    setHistory(start(nextSeed, startSide));
  }

  /** The log in words, with the side after each traverse and the turn each one ended. */
  const logLines = useMemo(() => {
    let side = g.log.length ? (history.past[0]?.side ?? g.side) : g.side;
    let turn = 1;
    const cardName = (uid: string) => {
      for (const s of [g, ...history.past]) {
        for (const z of Object.values(s.zones)) {
          const c = z.find((x) => x.uid === uid);
          if (c) return nameOf(c.card.id);
        }
      }
      return uid;
    };
    return g.log.map((a) => {
      switch (a.type) {
        case "draw":
          return a.count && a.count > 1 ? `Draw ${a.count}` : "Draw";
        case "move":
          return `${cardName(a.uid)} to ${
            a.to === "deck"
              ? `${a.position === "bottom" ? "bottom" : "top"} of deck`
              : LABEL[a.to]!.toLowerCase()
          }`;
        case "pitch":
          return `Pitch ${cardName(a.uid)}`;
        case "token":
          return `${a.delta > 0 ? "+" : ""}${a.delta} ${a.token}`;
        case "resources":
          return `${a.delta > 0 ? "+" : ""}${a.delta} resources`;
        case "traverse":
          side = side === "forsaken" ? "usurper" : "forsaken";
          return `Traverse to ${sideName(side)}`;
        case "shuffle":
          return "Shuffle the deck";
        case "endTurn":
          return `End turn ${turn++}`;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  return (
    <section aria-label="Goldfish" className={styles.goldfish}>
      <header className={styles.bar}>
        <strong>{`Turn ${g.turn}`}</strong>
        <span className={styles.side}>{`On ${sideName(g.side)}`}</span>
        <Button onClick={() => doAction({ type: "traverse" })}>Traverse</Button>
        <Button variant="primary" onClick={() => doAction({ type: "endTurn" })}>
          End turn
        </Button>
        <Button
          onClick={() => setHistory(undo)}
          disabled={history.past.length === 0}
        >
          Undo
        </Button>
        <Button
          onClick={() => setHistory(redo)}
          disabled={history.future.length === 0}
        >
          Redo
        </Button>
        <span className={styles.muted}>{`Seed ${seed}`}</span>
        <form
          className={styles.restart}
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(seedInput);
            restart(Number.isInteger(n) && n >= 0 ? n : randomSeed());
          }}
        >
          <TextField
            label="Seed"
            hideLabel
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            inputMode="numeric"
          />
          <label className={styles.startSide}>
            <span>Start on</span>
            <select
              value={startSide}
              onChange={(e) => setStartSide(e.target.value as typeof startSide)}
            >
              <option value="forsaken">Forsaken</option>
              <option value="usurper">Usurper</option>
            </select>
          </label>
          <Button type="submit">Restart</Button>
          <Button onClick={() => restart(randomSeed())}>New shuffle</Button>
        </form>
      </header>

      <div className={styles.counters}>
        <Counter
          label="Resources"
          text={`Resources ${g.resources}`}
          onChange={(delta) => doAction({ type: "resources", delta })}
        />
        {TOKENS.map((t) => {
          const made = g.createdThisTurn[t.token] ?? 0;
          return (
            <Counter
              key={t.token}
              label={t.label}
              text={`${t.label} ${g.tokens[t.token] ?? 0}${made ? ` · ${made} made this turn` : ""}`}
              onChange={(delta) =>
                doAction({ type: "token", token: t.token, delta })
              }
            />
          );
        })}
      </div>

      <div className={styles.table}>
        <section aria-label="Deck" className={styles.zone}>
          <h3>{`Deck · ${g.zones.deck.length}`}</h3>
          <div className={styles.deckBack} aria-hidden="true" />
          <div className={styles.deckActions}>
            <Button
              onClick={() => doAction({ type: "draw" })}
              disabled={g.zones.deck.length === 0}
            >
              Draw
            </Button>
            <Button onClick={() => doAction({ type: "shuffle" })}>
              Shuffle
            </Button>
          </div>
        </section>
        {ZONE_LABELS.map(({ zone, label }) => (
          <section
            key={zone}
            aria-label={label}
            className={styles.zone}
            data-zone={zone}
          >
            <h3>{`${label} · ${g.zones[zone].length}`}</h3>
            <ul className={styles.cards}>
              {g.zones[zone].map((c) => {
                const name = nameOf(c.card.id);
                const image = images.get(c.card.id);
                return (
                  <li key={c.uid} aria-label={name} className={styles.card}>
                    {image ? (
                      <img src={image} alt="" loading="lazy" />
                    ) : (
                      <span className={styles.standIn}>{name}</span>
                    )}
                    <select
                      aria-label={`Action for ${name}`}
                      value=""
                      onChange={(e) => {
                        const choice = CARD_ACTIONS.find(
                          (a) => a.label === e.target.value,
                        );
                        if (choice) doAction(choice.action(c.uid));
                      }}
                    >
                      <option value="" disabled>
                        Move…
                      </option>
                      {CARD_ACTIONS.filter((a) => a.zone !== zone).map((a) => (
                        <option key={a.label} value={a.label}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <section className={styles.logBox}>
        <h3>Action log</h3>
        {logLines.length === 0 ? (
          <p className={styles.muted}>Nothing yet.</p>
        ) : (
          <ol aria-label="Action log" className={styles.log}>
            {logLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}

function Counter(props: {
  label: string;
  text: string;
  onChange: (delta: number) => void;
}) {
  return (
    <span className={styles.counter}>
      <button
        type="button"
        aria-label={`Fewer ${props.label}`}
        onClick={() => props.onChange(-1)}
      >
        −
      </button>
      <span>{props.text}</span>
      <button
        type="button"
        aria-label={`More ${props.label}`}
        onClick={() => props.onChange(1)}
      >
        +
      </button>
    </span>
  );
}
