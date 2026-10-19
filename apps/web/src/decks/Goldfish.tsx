import {
  act,
  newGame,
  redo,
  ScenarioCannotRun,
  replay,
  undo,
  type CardInstance,
  type GameAction,
  type GameSetup,
  type GameHistory,
  type HeroSide,
  type Zone,
} from "@vdb/engine";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { engineCardOf } from "../ranking/scenarios.ts";
import { Button, TextField } from "../ui/index.ts";
import { sectionOf, variantName, type DeckEntry } from "./deckRules.ts";
import { decodeFixed, encodeFixed } from "./goldfishLink.ts";
import { turnRecaps } from "./goldfishRecap.ts";
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
const LABEL: Record<string, string> = Object.fromEntries(
  ZONE_LABELS.map((z) => [z.zone, z.label]),
);

/** What a card can do, from its menu, its keyboard key, or a drag. */
const CARD_ACTIONS: {
  label: string;
  key?: string;
  zone?: Zone;
  action: (uid: string) => GameAction;
}[] = [
  {
    label: "Play",
    key: "p",
    zone: "arena",
    action: (uid) => ({ type: "move", uid, to: "arena" }),
  },
  {
    label: "Pitch",
    key: "i",
    zone: "pitch",
    action: (uid) => ({ type: "pitch", uid }),
  },
  {
    label: "Hand",
    key: "h",
    zone: "hand",
    action: (uid) => ({ type: "move", uid, to: "hand" }),
  },
  {
    label: "Arsenal",
    key: "a",
    zone: "arsenal",
    action: (uid) => ({ type: "move", uid, to: "arsenal" }),
  },
  {
    label: "Graveyard",
    key: "g",
    zone: "graveyard",
    action: (uid) => ({ type: "move", uid, to: "graveyard" }),
  },
  {
    label: "Banish",
    key: "b",
    zone: "banished",
    action: (uid) => ({ type: "move", uid, to: "banished" }),
  },
  {
    label: "Banish face down",
    action: (uid) => ({ type: "move", uid, to: "banished", faceDown: true }),
  },
  {
    label: "Top of deck",
    key: "t",
    action: (uid) => ({ type: "move", uid, to: "deck", position: "top" }),
  },
  {
    label: "Bottom of deck",
    key: "u",
    action: (uid) => ({ type: "move", uid, to: "deck", position: "bottom" }),
  },
];

const TOKENS = [
  { token: "runechant", label: "Runechants" },
  { token: "gate", label: "Gates" },
  { token: "eloquence", label: "Eloquence" },
];

const randomSeed = () => Math.floor(Math.random() * 1_000_000);

/** A session's log in a link: base64url JSON. */
function encodeLog(log: GameAction[]): string {
  return btoa(JSON.stringify(log))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function decodeLog(text: string): GameAction[] | null {
  try {
    const parsed: unknown = JSON.parse(
      atob(text.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return Array.isArray(parsed) ? (parsed as GameAction[]) : null;
  } catch {
    return null;
  }
}

/** A new game; fixed cards the deck no longer has are left out rather than failing. */
function start(setup: GameSetup) {
  try {
    return newGame(setup);
  } catch (e) {
    if (e instanceof ScenarioCannotRun) return newGame({ ...setup, fixed: [] });
    throw e;
  }
}

const typing = (target: EventTarget | null) =>
  !!(target as HTMLElement | null)?.closest?.("input, select, textarea");

/**
 * The goldfish tool (README "Goldfishing", phase two step 5): a sandbox for playing a deck's
 * turns alone, on the shared game engine. The user moves every card; the tool keeps count and
 * enforces no game rules. End turn is a helper: pitched cards to the bottom, draw up to 4.
 */
export function Goldfish(props: {
  entries: DeckEntry[];
  seed?: number;
  side?: HeroSide;
  /** A shared session's log, from its link. */
  log?: string;
  /** Cards a scenario fixed in hand or arsenal, from a failed run's link. */
  fixed?: string;
}) {
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
        fixed: props.fixed ? decodeFixed(props.fixed) : [],
      },
      names: new Map(
        main.map((e) => [e.variant.id, variantName(e.card, e.variant)]),
      ),
      images: new Map(main.map((e) => [e.variant.id, e.variant.imageUrl])),
    };
  }, [props.entries, props.fixed]);

  const [seed, setSeed] = useState(() => props.seed ?? randomSeed());
  const [seedInput, setSeedInput] = useState(String(seed));
  const [startSide, setStartSide] = useState<HeroSide>(
    props.side ?? "forsaken",
  );
  const [history, setHistory] = useState<GameHistory>(() => {
    const game = { ...setup, seed, side: props.side ?? "forsaken" };
    const log = props.log ? decodeLog(props.log) : null;
    if (log) {
      try {
        return replay(game, log);
      } catch {
        // A link for a deck that has changed since: start fresh.
      }
    }
    return start(game);
  });
  const [lookAt, setLookAt] = useState(3);
  const [looking, setLooking] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const g = history.present;
  const doAction = (action: GameAction) => setHistory((h) => act(h, action));
  const sideName = (side: string) =>
    side === "usurper" ? "Usurper" : "Forsaken";
  const startedOn = history.past[0]?.side ?? g.side;

  // Every copy is always in some zone, so the present state names them all.
  const uidNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const zone of Object.values(g.zones))
      for (const c of zone) m.set(c.uid, names.get(c.card.id) ?? c.card.name);
    return m;
  }, [g.zones, names]);
  const nameOf = (uid: string) => uidNames.get(uid) ?? uid;

  function restart(nextSeed = seed) {
    setSeed(nextSeed);
    setSeedInput(String(nextSeed));
    setShareLink(null);
    setHistory(start({ ...setup, seed: nextSeed, side: startSide }));
  }

  // Keys for the table: D draw, E end turn, Ctrl/⌘+Z undo, with Shift redo.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (typing(e.target) || e.altKey) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "z") {
        e.preventDefault();
        setHistory(e.shiftKey ? redo : undo);
      } else if (e.ctrlKey || e.metaKey) return;
      else if (key === "d") setHistory((h) => act(h, { type: "draw" }));
      else if (key === "e") setHistory((h) => act(h, { type: "endTurn" }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logLines = useMemo(() => {
    let side = startedOn;
    let turn = 1;
    return g.log.map((a) => {
      switch (a.type) {
        case "draw":
          return a.count && a.count > 1 ? `Draw ${a.count}` : "Draw";
        case "move":
          return `${nameOf(a.uid)} to ${
            a.to === "deck"
              ? `${a.position === "bottom" ? "bottom" : "top"} of deck`
              : LABEL[a.to]!.toLowerCase()
          }${a.faceDown ? " face down" : ""}`;
        case "pitch":
          return `Pitch ${nameOf(a.uid)}`;
        case "token":
          return `${a.delta > 0 ? "+" : ""}${a.delta} ${a.token}`;
        case "resources":
          return `${a.delta > 0 ? "+" : ""}${a.delta} resources`;
        case "attack":
          return `Attack with ${nameOf(a.uid)}`;
        case "use":
          return `Use ${nameOf(a.uid)}`;
        case "counter":
          return `${a.delta > 0 ? "+" : ""}${a.delta} counter on ${nameOf(a.uid)}`;
        case "life":
          return `${a.delta > 0 ? "+" : ""}${a.delta} life`;
        case "damage":
          return `${a.delta > 0 ? "+" : ""}${a.delta} damage`;
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
  }, [history, uidNames]);
  const recaps = useMemo(
    () => turnRecaps(g.log, startedOn, nameOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, uidNames],
  );

  /** A card: its picture (or the back if face down), its menu, its keys, and dragging. */
  const renderCard = (c: CardInstance, zone: Zone) => {
    const faceDown = g.faceDown.includes(c.uid);
    const name = nameOf(c.uid);
    const label = faceDown ? `${name} (face down)` : name;
    const image = images.get(c.card.id);
    const used = g.used.includes(c.uid);
    const onKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const choice = CARD_ACTIONS.find(
        (a) => a.key === e.key.toLowerCase() && a.zone !== zone,
      );
      if (!choice) return;
      e.preventDefault();
      e.stopPropagation();
      doAction(choice.action(c.uid));
    };
    return (
      <li
        key={c.uid}
        aria-label={label}
        className={styles.card}
        tabIndex={0}
        draggable
        onDragStart={() => setDragging(c.uid)}
        onDragEnd={() => setDragging(null)}
        onKeyDown={onKeyDown}
      >
        {faceDown ? (
          <span className={styles.back} />
        ) : image ? (
          <img src={image} alt="" loading="lazy" />
        ) : (
          <span className={styles.standIn}>{name}</span>
        )}
        <select
          aria-label={`Action for ${label}`}
          value=""
          onChange={(e) => {
            const choice = CARD_ACTIONS.find((a) => a.label === e.target.value);
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
        {(zone === "weapons" || zone === "equipment") && (
          <div className={styles.gear}>
            {zone === "weapons" ? (
              <Button
                disabled={used}
                onClick={() => doAction({ type: "attack", uid: c.uid })}
              >
                {`Attack with ${name}`}
              </Button>
            ) : (
              <Button onClick={() => doAction({ type: "use", uid: c.uid })}>
                {`${used ? "Unuse" : "Use"} ${name}`}
              </Button>
            )}
            {used && <span className={styles.used}>Used this turn</span>}
            <Counter
              label={`counters on ${name}`}
              text={`Counters ${g.counters[c.uid] ?? 0}`}
              onChange={(delta) =>
                doAction({ type: "counter", uid: c.uid, delta })
              }
            />
          </div>
        )}
      </li>
    );
  };
  const dropOn = (zone: Zone) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragging) doAction({ type: "move", uid: dragging, to: zone });
      setDragging(null);
    },
  });

  const sortedDeck = [...g.zones.deck].sort((a, b) =>
    nameOf(a.uid).localeCompare(nameOf(b.uid)),
  );

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
              onChange={(e) => setStartSide(e.target.value as HeroSide)}
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
        <Counter
          label="life"
          text={`Life ${g.life}`}
          onChange={(delta) => doAction({ type: "life", delta })}
        />
        <Counter
          label="damage"
          text={`Damage ${g.damageThisTurn} · ${g.damageTotal} in total`}
          onChange={(delta) => doAction({ type: "damage", delta })}
        />
      </div>

      <div className={styles.table}>
        <section aria-label="Deck" className={styles.zone} {...dropOn("deck")}>
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
            <Button
              onClick={() => {
                setLooking(true);
                setSearching(false);
              }}
            >
              {`Look at top ${lookAt}`}
            </Button>
            <label className={styles.lookAt}>
              <span className={styles.visuallyHidden}>How many to look at</span>
              <input
                type="number"
                min={1}
                max={20}
                value={lookAt}
                onChange={(e) =>
                  setLookAt(
                    Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                  )
                }
              />
            </label>
            <Button
              onClick={() => {
                setSearching(true);
                setLooking(false);
              }}
            >
              Search the deck
            </Button>
          </div>
          {looking && (
            <div className={styles.peek}>
              <ol aria-label="Top of deck" className={styles.cards}>
                {g.zones.deck
                  .slice(0, lookAt)
                  .map((c) => renderCard(c, "deck"))}
              </ol>
              <Button onClick={() => setLooking(false)}>Close</Button>
            </div>
          )}
          {searching && (
            <div className={styles.peek}>
              <ul aria-label="Cards in the deck" className={styles.cards}>
                {sortedDeck.map((c) => renderCard(c, "deck"))}
              </ul>
              <Button
                variant="primary"
                onClick={() => {
                  doAction({ type: "shuffle" });
                  setSearching(false);
                }}
              >
                Shuffle and close
              </Button>
              <Button onClick={() => setSearching(false)}>
                Close without shuffling
              </Button>
            </div>
          )}
        </section>
        {ZONE_LABELS.map(({ zone, label }) => (
          <section
            key={zone}
            aria-label={label}
            className={styles.zone}
            data-zone={zone}
            {...dropOn(zone)}
          >
            <h3>{`${label} · ${g.zones[zone].length}`}</h3>
            <ul className={styles.cards}>
              {g.zones[zone].map((c) => renderCard(c, zone))}
            </ul>
          </section>
        ))}
      </div>

      <div className={styles.history}>
        <section className={styles.logBox}>
          <h3>Turn recaps</h3>
          {recaps.length === 0 ? (
            <p className={styles.muted}>Each turn is summed up when it ends.</p>
          ) : (
            <ol aria-label="Turn recaps" className={styles.log}>
              {recaps.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          )}
        </section>
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
        <section className={styles.logBox}>
          <h3>Share</h3>
          <Button
            onClick={() => {
              const url = new URL(window.location.href);
              url.search = new URLSearchParams({
                tab: "goldfish",
                seed: String(seed),
                ...(startedOn === "usurper" ? { side: "usurper" } : {}),
                log: encodeLog(g.log),
                ...(setup.fixed.length
                  ? { fixed: encodeFixed(setup.fixed) }
                  : {}),
              }).toString();
              setShareLink(url.toString());
              void navigator.clipboard
                ?.writeText(url.toString())
                .catch(() => {});
            }}
          >
            Share this session
          </Button>
          {shareLink && (
            <TextField label="Share link" readOnly value={shareLink} />
          )}
          <p className={styles.muted}>
            Keys: on a card, P play, I pitch, A arsenal, G graveyard, B banish,
            H hand, T or U top or bottom of the deck. D draw, E end turn,
            Ctrl/⌘+Z undo, with Shift redo. Cards can be dragged between zones.
          </p>
        </section>
      </div>
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
