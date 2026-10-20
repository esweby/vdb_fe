import { ScenarioCannotRun, type HeroSide, type Zone } from "@vdb/engine";
import {
  applySessionAction,
  BLOOD_DEBT,
  NeedsChoice,
  replaySession,
  RulesError,
  RUNECHANT,
  setUp,
  VISERAI,
  type ChoiceRequest,
  type RulesInstance,
  type RulesSetup,
  type RulesState,
  type SessionAction,
} from "@vdb/engine/rules";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { rulesCardOf } from "../scenarios/rulesCards.ts";
import { Button, TextField } from "../ui/index.ts";
import {
  sectionOf,
  slotOf,
  SLOTS,
  variantName,
  type DeckEntry,
} from "./deckRules.ts";
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

const PLAYABLE_FROM: Zone[] = ["hand", "arsenal", "banished"];

/** Equipment slots on the mat, in the order they're laid out. */
const EQUIPMENT_SLOTS = SLOTS;

/**
 * What a card can do, from its menu, its keyboard key, or a drag. Play and Pitch follow the
 * rules for cards whose rules are verified; everything else is a move by hand.
 */
const CARD_ACTIONS: {
  label: string;
  key?: string;
  zone?: Zone;
  action: (c: RulesInstance, from: Zone) => SessionAction;
}[] = [
  {
    label: "Play",
    key: "p",
    zone: "arena",
    action: (c, from) =>
      c.card.effects !== undefined && PLAYABLE_FROM.includes(from)
        ? { type: "play", uid: c.uid }
        : { type: "move", uid: c.uid, to: "arena" },
  },
  {
    label: "Pitch",
    key: "i",
    zone: "pitch",
    action: (c) => ({ type: "pitch", uid: c.uid }),
  },
  {
    label: "To arena (by hand)",
    action: (c) => ({ type: "move", uid: c.uid, to: "arena" }),
  },
  {
    label: "Hand",
    key: "h",
    zone: "hand",
    action: (c) => ({ type: "move", uid: c.uid, to: "hand" }),
  },
  {
    label: "Arsenal",
    key: "a",
    zone: "arsenal",
    action: (c) => ({ type: "move", uid: c.uid, to: "arsenal" }),
  },
  {
    label: "Graveyard",
    key: "g",
    zone: "graveyard",
    action: (c) => ({ type: "move", uid: c.uid, to: "graveyard" }),
  },
  {
    label: "Banish",
    key: "b",
    zone: "banished",
    action: (c) => ({ type: "move", uid: c.uid, to: "banished" }),
  },
  {
    label: "Banish face down",
    action: (c) => ({
      type: "move",
      uid: c.uid,
      to: "banished",
      faceDown: true,
    }),
  },
  {
    label: "Top of deck",
    key: "t",
    action: (c) => ({ type: "move", uid: c.uid, to: "deck", position: "top" }),
  },
  {
    label: "Bottom of deck",
    key: "u",
    action: (c) => ({
      type: "move",
      uid: c.uid,
      to: "deck",
      position: "bottom",
    }),
  },
];

const TOKENS = [
  { token: "runechant", label: "Runechants" },
  { token: "gate", label: "Gates" },
  { token: "eloquence", label: "Eloquence" },
];

/** Piles that open as a list when clicked (the maintainer, 20 Oct 2026). */
type Opened = "graveyard" | "banished" | "deck";
const OPEN_LABEL: Record<Opened, string> = {
  graveyard: "Open the graveyard",
  banished: "Open the banished zone",
  deck: "Open the deck",
};

/** Starting life (UNVERIFIED for the new Viserai). */
const LIFE = 40;

/** Optional triggers, asked in plain words. */
const CONFIRM_TEXT: Record<string, string> = {
  "viserai-usurper-traverse": "Viserai, the Usurper: traverse to Forsaken?",
};

const randomSeed = () => Math.floor(Math.random() * 1_000_000);

/** A session's log in a link: base64url JSON. */
function encodeLog(log: SessionAction[]): string {
  const bytes = new TextEncoder().encode(JSON.stringify(log));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function decodeLog(text: string): SessionAction[] | null {
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))),
    );
    return Array.isArray(parsed) ? (parsed as SessionAction[]) : null;
  } catch {
    return null;
  }
}

/** A new game; fixed cards the deck no longer has are left out rather than failing. */
function start(setup: RulesSetup) {
  try {
    return setUp(setup);
  } catch (e) {
    if (e instanceof ScenarioCannotRun) return setUp({ ...setup, fixed: [] });
    throw e;
  }
}

interface History {
  initial: RulesState;
  steps: { action: SessionAction; state: RulesState }[];
  /** How many steps are in effect; the rest can be redone. */
  cursor: number;
}

const typing = (target: EventTarget | null) =>
  !!(target as HTMLElement | null)?.closest?.("input, select, textarea");

/**
 * The goldfish tool (README "Goldfishing"; docs/rules-engine.md, step 8): playing a deck's turns
 * alone. Cards with verified rules are played by them, and Viserai, Runechants and Blood Debt
 * resolve by themselves; anything else is moved by hand, as a sandbox.
 */
export function Goldfish(props: {
  entries: DeckEntry[];
  seed?: number;
  side?: HeroSide;
  /** A shared session's log, from its link. */
  log?: string;
  /** Cards a scenario fixed in hand or arsenal, from a failed run's link. */
  fixed?: string;
  /** Viserai's card pictures, by side, when the hero list has them. */
  heroImages?: Partial<Record<HeroSide, string | null>>;
}) {
  // Each copy, by section: the main deck, then the weapons and equipment in play.
  const { setup, names, images, slots, tokensMade } = useMemo(() => {
    const main = props.entries.filter((e) => !e.sideboard);
    const copies = (section: "deck" | "weapon" | "equipment") =>
      main
        .filter((e) => sectionOf(e.card) === section)
        .flatMap((e) =>
          Array.from({ length: e.quantity }, () =>
            rulesCardOf(e.card, e.variant),
          ),
        );
    return {
      setup: {
        deck: copies("deck"),
        weapons: copies("weapon"),
        equipment: copies("equipment"),
        fixed: props.fixed ? decodeFixed(props.fixed) : [],
        triggers: [...VISERAI, RUNECHANT, BLOOD_DEBT],
      },
      names: new Map(
        main.map((e) => [e.variant.id, variantName(e.card, e.variant)]),
      ),
      images: new Map(main.map((e) => [e.variant.id, e.variant.imageUrl])),
      slots: new Map(main.map((e) => [e.variant.id, slotOf(e.card)])),
      // Viserai makes Runechants; other tokens only if a card in the deck makes them.
      tokensMade: new Set([
        "runechant",
        ...main.flatMap((e) =>
          [e.card.attributes, e.variant.attributes].flatMap((a) =>
            (a.tokens ?? []).map((t) => t.token as string),
          ),
        ),
      ]),
    };
  }, [props.entries, props.fixed]);

  const [seed, setSeed] = useState(() => props.seed ?? randomSeed());
  const [seedInput, setSeedInput] = useState(String(seed));
  const [startSide, setStartSide] = useState<HeroSide>(
    props.side ?? "forsaken",
  );
  const [history, setHistory] = useState<History>(() => {
    const game = { ...setup, seed, side: props.side ?? "forsaken" };
    const initial = start(game);
    const log = props.log ? decodeLog(props.log) : null;
    if (log) {
      try {
        // Replays the whole log, then keeps each step so it can be undone.
        replaySession(game, log);
        let state = initial;
        const steps = log.map((action) => {
          state = applySessionAction(state, action);
          return { action, state };
        });
        return { initial, steps, cursor: steps.length };
      } catch {
        // A link for a deck that has changed since: start fresh.
      }
    }
    return { initial, steps: [], cursor: 0 };
  });
  const [pending, setPending] = useState<{
    action: SessionAction;
    request: ChoiceRequest;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookAt, setLookAt] = useState(3);
  const [looking, setLooking] = useState(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  const pileList = useRef<HTMLElement>(null);
  // An opened pile takes focus, so Escape closes it.
  useEffect(() => {
    if (opened) pileList.current?.focus({ preventScroll: true });
  }, [opened]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const g =
    history.cursor > 0
      ? history.steps[history.cursor - 1]!.state
      : history.initial;
  const log = history.steps.slice(0, history.cursor).map((s) => s.action);
  const startedOn = history.initial.side;

  // The latest history, so actions from keys build on it.
  const latest = useRef(history);
  latest.current = history;

  /** Apply an action: by the rules or by hand. A choice the rules need is asked first. */
  function perform(action: SessionAction) {
    const h = latest.current;
    const present = h.cursor > 0 ? h.steps[h.cursor - 1]!.state : h.initial;
    try {
      const state = applySessionAction(present, action);
      const next: History = {
        ...h,
        steps: [...h.steps.slice(0, h.cursor), { action, state }],
        cursor: h.cursor + 1,
      };
      latest.current = next;
      setHistory(next);
      setPending(null);
      setError(null);
    } catch (e) {
      if (e instanceof NeedsChoice) {
        setPending({ action, request: e.request });
        setError(null);
      } else if (e instanceof RulesError) {
        setPending(null);
        setError(e.message);
      } else throw e;
    }
  }
  const performRef = useRef(perform);
  performRef.current = perform;

  function answer(pick: string[]) {
    if (!pending) return;
    const { action } = pending;
    if (!("answers" in action) && !isRulesAction(action)) return;
    perform({
      ...action,
      answers: [...(("answers" in action && action.answers) || []), pick],
    } as SessionAction);
  }

  /** Undo, redo or restart: a half-asked choice no longer fits the table. */
  const move = (change: (h: History) => History) => {
    setPending(null);
    setError(null);
    setHistory((h) => {
      const next = change(h);
      latest.current = next;
      return next;
    });
  };
  const undo = (h: History) => ({ ...h, cursor: Math.max(0, h.cursor - 1) });
  const redo = (h: History) => ({
    ...h,
    cursor: Math.min(h.steps.length, h.cursor + 1),
  });
  const sideName = (side: string) =>
    side === "usurper" ? "Usurper" : "Forsaken";

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
    move(() => ({
      initial: start({ ...setup, seed: nextSeed, side: startSide }),
      steps: [],
      cursor: 0,
    }));
  }

  // Keys for the table: D draw, E end turn, Ctrl/⌘+Z undo, with Shift redo.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (typing(e.target) || e.altKey) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "z") {
        e.preventDefault();
        move(e.shiftKey ? redo : undo);
      } else if (e.ctrlKey || e.metaKey) return;
      else if (key === "d") performRef.current({ type: "draw" });
      else if (key === "e") performRef.current({ type: "endTurn" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logLines = useMemo(() => {
    let side = startedOn;
    let turn = 1;
    return log.map((a) => {
      switch (a.type) {
        case "draw":
          return a.count && a.count > 1 ? `Draw ${a.count}` : "Draw";
        case "move":
          return `${nameOf(a.uid)} to ${
            a.to === "deck"
              ? `${a.position === "bottom" ? "bottom" : "top"} of deck`
              : LABEL[a.to]!.toLowerCase()
          }${a.faceDown ? " face down" : ""}`;
        case "play":
          return `Play ${nameOf(a.uid)}`;
        case "pitch":
          return `Pitch ${nameOf(a.uid)}`;
        case "activateGate":
          return `Activate a Gate for ${nameOf(a.target)}`;
        case "weaponAttack":
        case "markAttack":
          return `Attack with ${nameOf(a.uid)}`;
        case "token":
          return `${a.delta > 0 ? "+" : ""}${a.delta} ${a.token}`;
        case "resources":
          return `${a.delta > 0 ? "+" : ""}${a.delta} resources`;
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
    () => turnRecaps(g.events, startedOn, nameOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, uidNames],
  );

  // Damage dealt: arcane damage from the rules, plus damage noted by hand.
  const turnStart = g.events.findLastIndex((e) => e.type === "turnStarted");
  const damageOf = (from: number) =>
    g.events
      .slice(from)
      .reduce(
        (n, e) =>
          e.type === "arcaneDamage" || e.type === "damageNoted"
            ? n + e.amount
            : n,
        0,
      );

  /** A card: its picture (or the back if face down), its menu, its keys, and dragging. */
  const renderCard = (c: RulesInstance, zone: Zone, index?: number) => {
    const faceDown = g.faceDown.includes(c.uid);
    const name = nameOf(c.uid);
    const label = faceDown ? `${name} (face down)` : name;
    const image = images.get(c.card.id);
    const used = g.usedThisTurn.includes(c.uid);
    const gear = zone === "weapons" || zone === "equipment";
    const counters = g.counters[c.uid] ?? 0;
    // Gear's own actions, in the same menu as the moves.
    const gearActions: {
      label: string;
      disabled?: boolean;
      run: () => void;
    }[] = !gear
      ? []
      : [
          zone === "weapons"
            ? {
                label: "Attack",
                disabled: used,
                run: () =>
                  perform(
                    c.card.weaponAttack
                      ? { type: "weaponAttack", uid: c.uid }
                      : { type: "markAttack", uid: c.uid },
                  ),
              }
            : {
                label: used ? "Unuse" : "Use",
                run: () => perform({ type: "use", uid: c.uid }),
              },
          {
            label: "Add a counter",
            run: () => perform({ type: "counter", uid: c.uid, delta: 1 }),
          },
        ];
    const onKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const choice = CARD_ACTIONS.find(
        (a) => a.key === e.key.toLowerCase() && a.zone !== zone,
      );
      if (!choice) return;
      e.preventDefault();
      e.stopPropagation();
      perform(choice.action(c, zone));
    };
    return (
      <li
        key={c.uid}
        aria-label={label}
        className={styles.card}
        data-used={used || undefined}
        style={index === undefined ? undefined : fan(index)}
        tabIndex={0}
        draggable
        onDragStart={(e) => {
          e.dataTransfer?.setData("text/plain", c.uid);
          setDragging(c.uid);
        }}
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
          className={styles.cardMenu}
          aria-label={`Action for ${label}`}
          value=""
          onChange={(e) => {
            const own = gearActions.find((a) => a.label === e.target.value);
            if (own) return own.run();
            const choice = CARD_ACTIONS.find((a) => a.label === e.target.value);
            if (choice) perform(choice.action(c, zone));
          }}
        >
          <option value="" disabled>
            {gear ? "Actions…" : "Move…"}
          </option>
          {gearActions.map((a) => (
            <option key={a.label} value={a.label} disabled={a.disabled}>
              {a.label}
            </option>
          ))}
          {CARD_ACTIONS.filter((a) => a.zone !== zone).map((a) => (
            <option key={a.label} value={a.label}>
              {a.label}
            </option>
          ))}
        </select>
        {used && <span className={styles.used}>Used this turn</span>}
        {gear && counters > 0 && (
          <>
            {/* A counter on the card itself, with − and + underneath (the maintainer, 20 Oct). */}
            <span
              className={styles.counterMark}
              aria-label={`${counters} counter${counters === 1 ? "" : "s"}`}
            >
              {counters}
            </span>
            <span className={styles.counterButtons}>
              <button
                type="button"
                aria-label={`Fewer counters on ${name}`}
                onClick={() =>
                  perform({ type: "counter", uid: c.uid, delta: -1 })
                }
              >
                −
              </button>
              <button
                type="button"
                aria-label={`More counters on ${name}`}
                onClick={() =>
                  perform({ type: "counter", uid: c.uid, delta: 1 })
                }
              >
                +
              </button>
            </span>
          </>
        )}
      </li>
    );
  };
  const dropOn = (zone: Zone) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const uid = dragging ?? e.dataTransfer?.getData("text/plain");
      setDragging(null);
      if (!uid) return;
      const from = (Object.keys(g.zones) as Zone[]).find((z) =>
        g.zones[z].some((c) => c.uid === uid),
      );
      const card = from && g.zones[from].find((c) => c.uid === uid);
      // Dropped on the arena it's played, on the pitch zone it's pitched: as the menu would.
      const byRules =
        card && from !== zone
          ? CARD_ACTIONS.find((a) => a.zone === zone && a.zone !== "hand")
          : undefined;
      perform(
        byRules && card && from
          ? byRules.action(card, from)
          : { type: "move", uid, to: zone },
      );
    },
  });

  /** A zone in its place on the mat. Piles overlap their cards, as a stack on the table. */
  const zoneSection = (zone: Zone, label: string, extra = "") => (
    <section
      aria-label={label}
      className={`${styles.zone} ${extra}`}
      data-place={zone}
      data-zone={zone}
      {...dropOn(zone)}
    >
      <h3
        className={styles.visuallyHidden}
      >{`${label} · ${g.zones[zone].length}`}</h3>
      {extra === styles.pile && (
        <span className={styles.count} data-testid="count" aria-hidden="true">
          {g.zones[zone].length}
        </span>
      )}
      {(zone === "graveyard" || zone === "banished") && (
        <button
          type="button"
          className={styles.openPile}
          aria-label={OPEN_LABEL[zone]}
          onClick={() => setOpened(zone)}
        />
      )}
      {g.zones[zone].length === 0 && (
        <div className={styles.emptySlot} aria-hidden="true">
          {zone === "arena" ? "No cards played this turn" : label}
        </div>
      )}
      <ul className={styles.cards}>
        {g.zones[zone].map((c, i) =>
          renderCard(c, zone, zone === "hand" ? i : undefined),
        )}
      </ul>
    </section>
  );
  /** The hand fans out from its middle. */
  const fan = (i: number) => {
    const from = i - (g.zones.hand.length - 1) / 2;
    return { "--fan": from, "--drop": Math.abs(from) } as React.CSSProperties;
  };

  const sortedDeck = [...g.zones.deck].sort((a, b) =>
    nameOf(a.uid).localeCompare(nameOf(b.uid)),
  );
  const request = pending?.request;
  const heroName =
    g.side === "usurper" ? "Viserai, the Usurper" : "Viserai, the Forsaken";

  return (
    <section aria-label="Goldfish" className={styles.goldfish}>
      <header className={styles.bar}>
        <strong>{`Turn ${g.turn}`}</strong>
        <span className={styles.side}>{`On ${sideName(g.side)}`}</span>
        <Button
          onClick={() => perform({ type: "draw" })}
          disabled={g.zones.deck.length === 0}
        >
          Draw
        </Button>
        <Button onClick={() => perform({ type: "traverse" })}>Traverse</Button>
        <Button variant="primary" onClick={() => perform({ type: "endTurn" })}>
          End turn
        </Button>
        <Button onClick={() => move(undo)} disabled={history.cursor === 0}>
          Undo
        </Button>
        <Button
          onClick={() => move(redo)}
          disabled={history.cursor === history.steps.length}
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

      {error && (
        <p role="alert" className={styles.refused}>
          {error}
        </p>
      )}
      {request && (
        <section aria-label="Choose" className={styles.prompts}>
          <h3>
            {request.kind === "confirm"
              ? (CONFIRM_TEXT[request.source ?? ""] ?? request.prompt)
              : request.prompt}
          </h3>
          {request.kind === "confirm" ? (
            <div className={styles.deckActions}>
              <Button variant="primary" onClick={() => answer(["yes"])}>
                Yes
              </Button>
              <Button onClick={() => answer([])}>No</Button>
            </div>
          ) : (
            <div className={styles.deckActions}>
              {request.options.map((uid) => (
                <Button key={uid} onClick={() => answer([uid])}>
                  {nameOf(uid)}
                </Button>
              ))}
              {request.optional && (
                <Button onClick={() => answer([])}>None</Button>
              )}
            </div>
          )}
          <Button variant="ghost" onClick={() => setPending(null)}>
            Cancel
          </Button>
        </section>
      )}

      <div className={styles.counters}>
        <Counter
          label="Resources"
          text={`Resources ${g.resources}`}
          onChange={(delta) => perform({ type: "resources", delta })}
        />
        {TOKENS.filter(
          (t) => tokensMade.has(t.token) || (g.tokens[t.token] ?? 0) > 0,
        ).map((t) => {
          const made = g.createdThisTurn[t.token] ?? 0;
          return (
            <Counter
              key={t.token}
              label={t.label}
              text={`${t.label} ${g.tokens[t.token] ?? 0}${made ? ` · ${made} made this turn` : ""}`}
              onChange={(delta) =>
                perform({ type: "token", token: t.token, delta })
              }
            />
          );
        })}
        <Counter
          label="life"
          text={`Life ${LIFE - g.lifeLost}`}
          onChange={(delta) => perform({ type: "life", delta })}
        />
        <Counter
          label="damage"
          text={`Damage ${damageOf(turnStart + 1)} · ${damageOf(0)} in total`}
          onChange={(delta) => perform({ type: "damage", delta })}
        />
      </div>

      {/* Laid out like a FaB playmat (the maintainer, 19 Oct 2026; after Fabrary and Talishar):
          equipment down the left, the arena across the top, weapons either side of the hero with
          the arsenal below it, pitch, deck, graveyard and banished on the right, the hand below. */}
      <section aria-label="Playmat" className={styles.mat}>
        <section
          aria-label="Equipment"
          className={`${styles.zone} ${styles.equipment}`}
          data-place="equipment"
          data-zone="equipment"
          {...dropOn("equipment")}
        >
          <h3
            className={styles.visuallyHidden}
          >{`Equipment · ${g.zones.equipment.length}`}</h3>
          {EQUIPMENT_SLOTS.filter(
            (slot) =>
              slot !== "Off-Hand" ||
              g.zones.equipment.some((c) => slots.get(c.card.id) === slot),
          ).map((slot) => {
            const here = g.zones.equipment.filter(
              (c) =>
                slots.get(c.card.id) === slot ||
                (slot === "Head" && !slots.get(c.card.id)),
            );
            return (
              <div
                key={slot}
                role="group"
                aria-label={`${slot} slot`}
                className={styles.slot}
                data-slot={slot}
              >
                <span className={styles.visuallyHidden}>{slot}</span>
                {here.length === 0 ? (
                  <span className={styles.slotEmpty}>
                    <span aria-hidden="true">{slot}</span>
                    <span className={styles.visuallyHidden}>Empty</span>
                  </span>
                ) : (
                  <ul className={styles.cards}>
                    {here.map((c) => renderCard(c, "equipment"))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
        {zoneSection("arena", "Arena")}
        {zoneSection("graveyard", "Graveyard", styles.pile)}
        {zoneSection("weapons", "Weapons")}
        <section aria-label="Hero" className={styles.hero} data-place="hero">
          {props.heroImages?.[g.side] ? (
            <img src={props.heroImages[g.side]!} alt={heroName} />
          ) : (
            <span className={styles.heroName}>{heroName}</span>
          )}
          <span className={styles.life}>{`${LIFE - g.lifeLost} life`}</span>
        </section>
        {zoneSection("pitch", "Pitch", styles.pile)}
        <section
          aria-label="Deck"
          className={`${styles.zone} ${styles.deckZone}`}
          data-place="deck"
          {...dropOn("deck")}
        >
          <h3
            className={styles.visuallyHidden}
          >{`Deck · ${g.zones.deck.length}`}</h3>
          <span className={styles.count} data-testid="count" aria-hidden="true">
            {g.zones.deck.length}
          </span>
          <button
            type="button"
            className={styles.deckBack}
            aria-label={OPEN_LABEL.deck}
            onClick={() => {
              setOpened("deck");
              setLooking(false);
            }}
          />
        </section>
        {zoneSection("arsenal", "Arsenal")}
        {zoneSection("banished", "Banished", styles.pile)}
        {zoneSection("hand", "Hand")}
      </section>

      {opened && (
        <section
          role="dialog"
          aria-label={LABEL[opened] ?? "Deck"}
          className={styles.pileList}
          tabIndex={-1}
          ref={pileList}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpened(null);
          }}
        >
          <header>
            <h3>{`${LABEL[opened] ?? "Deck"} · ${g.zones[opened].length}`}</h3>
            {opened === "deck" && (
              <div className={styles.deckActions}>
                <Button onClick={() => perform({ type: "shuffle" })}>
                  Shuffle
                </Button>
                <Button onClick={() => setLooking(true)}>
                  {`Look at top ${lookAt}`}
                </Button>
                <label className={styles.lookAt}>
                  <span className={styles.visuallyHidden}>
                    How many to look at
                  </span>
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
              </div>
            )}
          </header>
          {opened === "deck" && looking && (
            <ol aria-label="Top of deck" className={styles.cards}>
              {g.zones.deck.slice(0, lookAt).map((c) => renderCard(c, "deck"))}
            </ol>
          )}
          {g.zones[opened].length === 0 ? (
            <p className={styles.muted}>Nothing here.</p>
          ) : (
            <ul
              aria-label={
                opened === "deck"
                  ? "Cards in the deck"
                  : `Cards in the ${LABEL[opened]!.toLowerCase()} zone`
              }
              className={styles.cards}
            >
              {(opened === "deck" ? sortedDeck : g.zones[opened]).map((c) =>
                renderCard(c, opened),
              )}
            </ul>
          )}
          <div className={styles.deckActions}>
            {opened === "deck" ? (
              <>
                <Button
                  variant="primary"
                  onClick={() => {
                    perform({ type: "shuffle" });
                    setOpened(null);
                  }}
                >
                  Shuffle and close
                </Button>
                <Button onClick={() => setOpened(null)}>
                  Close without shuffling
                </Button>
              </>
            ) : (
              <Button onClick={() => setOpened(null)}>Close</Button>
            )}
          </div>
        </section>
      )}

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
                log: encodeLog(log),
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
            Cards with verified rules are played by them (Play), and Viserai,
            Runechants and Blood Debt happen by themselves. Anything else moves
            by hand. Keys: on a card, P play, I pitch, A arsenal, G graveyard, B
            banish, H hand, T or U top or bottom of the deck. D draw, E end
            turn, Ctrl/⌘+Z undo, with Shift redo. Cards can be dragged between
            zones.
          </p>
        </section>
      </div>
    </section>
  );
}

const RULES_ACTIONS = new Set([
  "play",
  "pitch",
  "activateGate",
  "weaponAttack",
  "endTurn",
]);
const isRulesAction = (a: SessionAction) => RULES_ACTIONS.has(a.type);

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
