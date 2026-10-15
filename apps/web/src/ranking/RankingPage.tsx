import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import { CardModal } from "../cards/CardModal.tsx";
import { CoreBuilder } from "./CoreBuilder.tsx";
import type { CorePick } from "./suggestCore.ts";
import type { Deck, DeckSummary } from "../decks/deckRepository.ts";
import type { FormatRules } from "../decks/deckRules.ts";
import { typeLine } from "../decks/CardTile.tsx";
import { cardFacets, pitchShown } from "../cards/facets.ts";
import { pitchName } from "../cards/pitch.ts";
import { useCards } from "../cards/useCards.ts";
import { applyFilters } from "../filters/applyFilters.ts";
import { FilteredLayout } from "../filters/FilteredLayout.tsx";
import { FilterBar } from "../filters/FilterBar.tsx";
import { FilterSidebar } from "../filters/FilterSidebar.tsx";
import { fromSearch, toSearch } from "../filters/urlState.ts";
import { useAppSelector } from "../hooks.ts";
import type { Dimension, ScoreRow } from "../scoring/scoreRepository.ts";
import { useServices } from "../servicesContext.ts";
import { Button, Slider, Tag } from "../ui/index.ts";
import { rankVariants, type CommunityRow, type RankedVariant } from "./rank.ts";
import {
  RISK_PRESETS,
  readRankingSearch,
  writeRankingSearch,
  type RankingSettings,
} from "./rankingSearch.ts";
import styles from "./RankingPage.module.css";

const route = getRouteApi("/ranking");
const facets = cardFacets();
const SLOTS = ["Head", "Chest", "Arms", "Legs", "Off-Hand"];
const GEAR = ["weapon", "equipment"];
/** Each pitch in the core's pitch mix, in the order players count them. */
const MIX_ORDER = [1, 2, 3, 4, null];

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

type Tab = "deck" | "gear" | "excluded";

interface Data {
  dimensions: Dimension[];
  community: CommunityRow[];
  minRatingCount: number;
  mine?: {
    rows: (ScoreRow & { cardId: string })[];
    reviewedCardIds: Set<string>;
  };
}

const label = (r: RankedVariant, multiPitch: boolean) =>
  multiPitch ? `${r.name} (${pitchName(r.pitch).toLowerCase()})` : r.name;

// Simple line icons (24×24, stroked), as on the card tiles.
const ICONS = {
  plus: "M12 5v14 M5 12h14",
  pin: "M9 3h6 M10 3v6l-4 5h12l-4-5V3 M12 14v7",
  x: "M6 6l12 12 M18 6 6 18",
} as const;
function Icon(props: { icon: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[props.icon]} />
    </svg>
  );
}

/** One row of mutually exclusive presets; the slider beside it fine-tunes. */
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

/** Floor to ceiling as a track, overall as a tick, and the value ranked on as a dot. */
function RangeBar(props: { r: RankedVariant }) {
  const { floor, overall, ceiling } = props.r.parts;
  const n = Math.round;
  return (
    <span
      className={styles.range}
      role="img"
      aria-label={`Floor ${n(floor)}, overall ${n(overall)}, ceiling ${n(ceiling)}`}
    >
      <span
        className={styles.track}
        style={{ left: `${floor}%`, width: `${ceiling - floor}%` }}
      />
      <span className={styles.overall} style={{ left: `${overall}%` }} />
      <span className={styles.dot} style={{ left: `${props.r.value}%` }} />
    </span>
  );
}

/** A small picture of the card, or a pitch-coloured stand-in when there's no image. */
function Thumb(props: { variant?: VariantSummary }) {
  const [failed, setFailed] = useState(false);
  const pitch = props.variant?.pitch ?? 0;
  return props.variant?.imageUrl && !failed ? (
    <img
      className={styles.thumb}
      src={props.variant.imageUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className={`${styles.thumb} ${styles[`pitch${pitch}`] ?? ""}`} />
  );
}

export function RankingPage() {
  const { status, items } = useCards();
  const { scores, decks } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const search = route.useSearch();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const deckId = typeof search.deck === "string" ? search.deck : undefined;
  const [deckList, setDeckList] = useState<DeckSummary[]>([]);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [rules, setRules] = useState<FormatRules | null>(null);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("deck");
  const [building, setBuilding] = useState(false);

  // The builder needs the copy limit even without a deck.
  useEffect(() => {
    if (!building || rules) return;
    let live = true;
    decks.getFormatRules().then(
      (r) => live && setRules(r),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [decks, building, rules]);

  useEffect(() => {
    if (!user) return;
    let live = true;
    decks.listDecks().then(
      (d) => live && setDeckList(d),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [decks, user]);

  useEffect(() => {
    if (!user || !deckId) {
      setDeck(null);
      return;
    }
    let live = true;
    Promise.all([decks.getDeck(deckId), decks.getFormatRules()]).then(
      ([d, r]) => {
        if (!live) return;
        setDeck(d);
        setRules(r);
      },
      (e) => live && setDeckError(String(e.message ?? e)),
    );
    return () => {
      live = false;
    };
  }, [decks, user, deckId]);

  useEffect(() => {
    let live = true;
    void Promise.all([
      scores.listDimensions(),
      scores.listCommunityScores(),
      scores.getMinRatingCount(),
      user ? scores.listAllMyScores(user.id) : Promise.resolve(null),
      user ? scores.listMyReviewedCardIds(user.id) : Promise.resolve(null),
    ]).then(([dimensions, community, minRatingCount, myRows, reviewed]) => {
      if (!live) return;
      setData({
        dimensions,
        community,
        minRatingCount,
        mine:
          myRows && reviewed
            ? { rows: myRows, reviewedCardIds: new Set(reviewed) }
            : undefined,
      });
    });
    return () => {
      live = false;
    };
  }, [scores, user]);

  const settings = readRankingSearch(search);
  const filterState = fromSearch(search);
  const update = (
    patch: Partial<RankingSettings>,
    filters = filterState,
    deckChoice = deckId,
  ) =>
    void navigate({
      to: ".",
      replace: true,
      // An in-page change (filters, settings): keep the scroll position.
      resetScroll: false,
      search: {
        ...writeRankingSearch({ ...settings, ...patch }),
        ...toSearch(filters),
        ...(deckChoice ? { deck: deckChoice } : {}),
      },
    });

  const candidates = useMemo(
    () => applyFilters(items, facets, filterState),
    [items, JSON.stringify(filterState)],
  );
  const variantsById = useMemo(
    () =>
      new Map(
        items.flatMap((card) =>
          card.variants.map((variant) => [variant.id, { card, variant }]),
        ),
      ),
    [items],
  );

  const ranked = useMemo(() => {
    if (!data) return [];
    return rankVariants({
      variants: candidates.flatMap((c) =>
        c.variants
          .filter((v) => pitchShown(filterState, v.pitch))
          .map((v) => ({
            cardId: c.id,
            variantId: v.id,
            name: c.name,
            pitch: v.pitch,
          })),
      ),
      dimensions: data.dimensions,
      community: data.community,
      mine: data.mine,
      risk: settings.risk,
      sourceBlend: data.mine ? settings.sourceBlend : 100,
      sideFocus: settings.sideFocus,
      minRatingCount: data.minRatingCount,
    });
  }, [data, candidates, JSON.stringify(settings)]);

  if (status !== "loaded" || !data) return <p>Loading…</p>;

  const cardOf = (variantId: string) =>
    variantsById.get(variantId)?.card as CardSummary;
  const isGear = (r: RankedVariant) => GEAR.includes(cardOf(r.variantId).type);
  const nameOf = (r: RankedVariant) =>
    label(r, cardOf(r.variantId).variants.length > 1);
  const excluded = new Set(settings.excluded);
  const pinned = settings.pinned;
  const inDeck = new Map(
    (deck?.cards ?? []).map((c) => [c.variantId, c.quantity]),
  );
  // README "Suggested core": cards in the deck being built count as pinned.
  const pinnedOrInDeck = [
    ...pinned,
    ...[...inDeck.keys()].filter((id) => !pinned.includes(id)),
  ];

  const copyLimit = rules?.copyLimit ?? Infinity;
  const atLimit = (variantId: string) =>
    (inDeck.get(variantId) ?? 0) >= copyLimit;
  const deckCardCount = (deck?.cards ?? [])
    .filter((c) => !c.sideboard)
    .filter(
      (c) => !GEAR.includes(variantsById.get(c.variantId)?.card.type ?? ""),
    )
    .reduce((n, c) => n + c.quantity, 0);

  async function addToDeck(variantId: string) {
    if (!deck || atLimit(variantId)) return;
    const existing = deck.cards.find((c) => c.variantId === variantId);
    const card = {
      variantId,
      quantity: (existing?.quantity ?? 0) + 1,
      sideboard: existing?.sideboard ?? false,
    };
    const previous = deck;
    setDeck({
      ...deck,
      cards: [...deck.cards.filter((c) => c.variantId !== variantId), card],
    });
    try {
      await decks.setCard(deck.id, card);
    } catch (e) {
      setDeck(previous);
      setDeckError(
        `Couldn't add to the deck: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** Adds the builder's picks, never lowering copies already in the deck. */
  async function addCore(
    deckId: string,
    picks: CorePick[],
    start: Deck["cards"],
  ) {
    let cards = start;
    for (const p of picks) {
      const existing = cards.find((c) => c.variantId === p.variantId);
      if ((existing?.quantity ?? 0) >= p.quantity) continue;
      const card = {
        variantId: p.variantId,
        quantity: p.quantity,
        sideboard: existing?.sideboard ?? false,
      };
      await decks.setCard(deckId, card);
      cards = [...cards.filter((c) => c.variantId !== p.variantId), card];
    }
    return cards;
  }
  async function addCoreToDeck(picks: CorePick[]) {
    if (!deck) return;
    const cards = await addCore(deck.id, picks, deck.cards);
    setDeck({ ...deck, cards });
  }
  async function saveCoreAsDeck(name: string, picks: CorePick[]) {
    const created = await decks.createDeck(name);
    await addCore(created.id, picks, []);
    setDeckList([created, ...deckList]);
    update({}, filterState, created.id);
  }

  const deckRows = ranked.filter(
    (r) => !isGear(r) && !excluded.has(r.variantId),
  );
  const ordered = [
    ...pinnedOrInDeck
      .map((id) => deckRows.find((r) => r.variantId === id))
      .filter((r): r is RankedVariant => !!r),
    ...deckRows.filter((r) => !pinnedOrInDeck.includes(r.variantId)),
  ];
  const core = ordered.slice(0, settings.coreSize);
  const pinnedInCore = core.filter((r) => pinned.includes(r.variantId)).length;
  const mix = MIX_ORDER.map((pitch) => ({
    pitch,
    n: core.filter((r) => r.pitch === pitch).length,
  })).filter((m) => m.n > 0);
  const excludedRows = ranked.filter((r) => excluded.has(r.variantId));
  const gear = ranked.filter((r) => isGear(r) && !excluded.has(r.variantId));
  const gearGroups = [
    {
      title: "Weapons",
      rows: gear.filter((r) => cardOf(r.variantId).type === "weapon"),
    },
    ...SLOTS.map((slot) => ({
      title: slot,
      rows: gear.filter((r) => cardOf(r.variantId).subtypes.includes(slot)),
    })),
  ].filter((g) => g.rows.length > 0);

  const togglePin = (id: string) =>
    update({
      pinned: pinned.includes(id)
        ? pinned.filter((p) => p !== id)
        : [...pinned, id],
    });
  const exclude = (id: string) =>
    update({
      excluded: [...settings.excluded, id],
      pinned: pinned.filter((p) => p !== id),
    });
  const restore = (id: string) =>
    update({ excluded: settings.excluded.filter((e) => e !== id) });

  // The pop-over steps through the deck cards in ranked order, each pitch its own stop.
  const open =
    typeof search.card === "string"
      ? items.find((c) => c.id === search.card)
      : undefined;
  const openVariant =
    typeof search.variant === "string" ? search.variant : undefined;
  const at = open
    ? ordered.findIndex(
        (r) =>
          r.cardId === open.id && (!openVariant || r.variantId === openVariant),
      )
    : -1;
  const goTo = (r: { cardId: string; variantId: string } | undefined) =>
    r &&
    void navigate({
      to: ".",
      replace: true,
      resetScroll: false,
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        card: r.cardId,
        variant: r.variantId,
      }),
    });
  const closeCard = () =>
    void navigate({
      to: ".",
      replace: true,
      resetScroll: false,
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        card: undefined,
        variant: undefined,
      }),
    });
  const nextCard =
    at >= 0
      ? ordered.slice(at + 1).find((r) => r.cardId !== open?.id)
      : undefined;

  const cardLink = (r: RankedVariant, name: string) => (
    <Link
      to="/ranking"
      search={(prev: Record<string, unknown>) => ({
        ...prev,
        card: r.cardId,
        variant: r.variantId,
      })}
      resetScroll={false}
      className={styles.name}
    >
      {name}
    </Link>
  );
  const addButton = (variantId: string, name: string) =>
    deck && (
      <Button
        variant="ghost"
        className={styles.iconButton}
        onClick={() => void addToDeck(variantId)}
        aria-label={`Add ${name} to ${deck.name}`}
        disabled={atLimit(variantId)}
        title={
          atLimit(variantId)
            ? `At most ${copyLimit} copies`
            : `Add to ${deck.name}`
        }
      >
        <Icon icon="plus" />
      </Button>
    );
  const inDeckTag = (variantId: string) =>
    inDeck.has(variantId) && (
      <Tag tone="accent">{inDeck.get(variantId)} in deck</Tag>
    );
  const ratings = (r: RankedVariant) =>
    r.ratingCount === 0
      ? "your review"
      : `${r.ratingCount} rating${r.ratingCount === 1 ? "" : "s"}`;

  const deckRow = (r: RankedVariant, i: number): ReactNode => {
    const name = nameOf(r);
    const { card, variant } = variantsById.get(r.variantId)!;
    const isPinned = pinned.includes(r.variantId);
    return (
      <tr
        key={r.variantId}
        className={i < settings.coreSize ? styles.inCore : undefined}
      >
        <td className={styles.rank}>{i + 1}</td>
        <td className={styles.thumbCell}>
          <Thumb variant={variant} />
        </td>
        <td className={styles.cardCell}>
          <span className={styles.nameLine}>
            <span
              className={`${styles.pitchDot} ${styles[`pitch${r.pitch ?? 0}`] ?? ""}`}
              aria-hidden="true"
            />
            {cardLink(r, name)}
            {isPinned && <Tag>Pinned</Tag>}
            {inDeckTag(r.variantId)}
          </span>
          <span className={styles.meta}>
            {typeLine(card)} · {ratings(r)}
          </span>
        </td>
        <td className={styles.rangeCell}>
          <RangeBar r={r} />
        </td>
        <td className={styles.value}>{Math.round(r.value)}</td>
        <td className={styles.actions}>
          {addButton(r.variantId, name)}
          <Button
            variant="ghost"
            className={styles.iconButton}
            data-on={isPinned || undefined}
            onClick={() => togglePin(r.variantId)}
            aria-label={`${isPinned ? "Unpin" : "Pin"} ${name}`}
            title={isPinned ? "Unpin" : "Pin to the core"}
          >
            <Icon icon="pin" />
          </Button>
          <Button
            variant="ghost"
            className={styles.iconButton}
            onClick={() => exclude(r.variantId)}
            aria-label={`Exclude ${name}`}
            title="Exclude"
          >
            <Icon icon="x" />
          </Button>
        </td>
      </tr>
    );
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "deck", label: "Deck cards", count: ordered.length },
    { id: "gear", label: "Weapons and equipment", count: gear.length },
    { id: "excluded", label: "Excluded", count: excludedRows.length },
  ];

  const priorities = (
    <section className={styles.priorities} aria-label="Priorities">
      <h2>Your priorities</h2>
      <div className={styles.setting}>
        <span className={styles.settingLabel}>Play style</span>
        <Presets
          label="Risk presets"
          options={RISK_PRESETS.map((p) => ({ label: p.label, value: p.risk }))}
          value={settings.risk}
          onChange={(risk) => update({ risk })}
        />
        <Slider
          label="Risk (floor ← → ceiling)"
          visibleLabel={null}
          noScale
          min={-100}
          max={100}
          step={10}
          value={settings.risk}
          onChange={(v) => update({ risk: v })}
        />
        <span className={styles.ends} aria-hidden="true">
          <span>Floor</span>
          <span>Ceiling</span>
        </span>
      </div>
      <div className={styles.setting}>
        <span className={styles.settingLabel}>Side</span>
        <Presets
          label="Side"
          options={SIDE_PRESETS}
          value={settings.sideFocus}
          onChange={(sideFocus) => update({ sideFocus })}
        />
        <Slider
          label="Side focus (Forsaken ← → Usurper)"
          visibleLabel={null}
          noScale
          value={settings.sideFocus}
          onChange={(v) => update({ sideFocus: v })}
        />
      </div>
      {data.mine && (
        <div className={styles.setting}>
          <span className={styles.settingLabel}>Whose scores</span>
          <Presets
            label="Whose scores"
            options={SOURCE_PRESETS}
            value={settings.sourceBlend}
            onChange={(sourceBlend) => update({ sourceBlend })}
          />
          <Slider
            label="Whose scores (mine ← → community)"
            visibleLabel={null}
            noScale
            value={settings.sourceBlend}
            onChange={(v) => update({ sourceBlend: v })}
          />
        </div>
      )}
      <div className={styles.setting}>
        <span className={styles.settingLabel}>Core size</span>
        <span className={styles.stepper}>
          <Button
            aria-label="Fewer core cards"
            onClick={() =>
              update({ coreSize: Math.max(1, settings.coreSize - 1) })
            }
          >
            −
          </Button>
          <output aria-label="Core size">{settings.coreSize}</output>
          <Button
            aria-label="More core cards"
            onClick={() =>
              update({ coreSize: Math.min(80, settings.coreSize + 1) })
            }
          >
            +
          </Button>
        </span>
      </div>
    </section>
  );

  return (
    <>
      {open && (
        <CardModal
          cardId={open.id}
          name={open.name}
          verified={open.attributesVerified}
          position={
            at >= 0 ? { index: at + 1, total: ordered.length } : undefined
          }
          variantId={openVariant}
          onPrevious={at > 0 ? () => goTo(ordered[at - 1]) : undefined}
          onNext={
            at >= 0 && ordered[at + 1] ? () => goTo(ordered[at + 1]) : undefined
          }
          onNextCard={nextCard ? () => goTo(nextCard) : undefined}
          onChooseVariant={(variantId) => goTo({ cardId: open.id, variantId })}
          onClose={closeCard}
        />
      )}
      <h1 className={styles.visuallyHidden}>Ranking</h1>
      <FilteredLayout
        state={filterState}
        facets={facets}
        onClear={() => update({}, {})}
        toggleLabel="Priorities and filters"
        count={`${ordered.length.toLocaleString("en-GB")} ranked`}
        bar={
          <FilterBar
            items={items}
            facets={facets}
            state={filterState}
            onChange={(next) => update({}, next)}
          />
        }
        sidebar={
          <>
            {priorities}
            <FilterSidebar
              items={items}
              facets={facets}
              state={filterState}
              onChange={(next) => update({}, next)}
            />
          </>
        }
      >
        <section className={styles.band} aria-label="Suggested core">
          <div className={styles.bandItem}>
            <span className={styles.settingLabel}>Suggested core</span>
            <span>
              <strong className={styles.big}>
                {core.length} {core.length === 1 ? "card" : "cards"}
              </strong>
              {pinnedInCore > 0 && (
                <span className={styles.muted}> · {pinnedInCore} pinned</span>
              )}
            </span>
          </div>
          {mix.length > 0 && (
            <div className={`${styles.bandItem} ${styles.mixItem}`}>
              <span className={styles.settingLabel}>Pitch mix</span>
              <span
                className={styles.mix}
                role="img"
                aria-label={`Pitch mix: ${mix
                  .map((m) => `${m.n} ${pitchName(m.pitch).toLowerCase()}`)
                  .join(", ")}`}
              >
                {mix.map((m) => (
                  <span
                    key={String(m.pitch)}
                    className={styles[`pitch${m.pitch ?? 0}`]}
                    style={{ flexGrow: m.n }}
                    title={`${m.n} ${pitchName(m.pitch).toLowerCase()}`}
                  />
                ))}
              </span>
            </div>
          )}
          {user && (
            <div className={styles.bandItem}>
              <label className={styles.settingLabel} htmlFor="ranking-deck">
                Add to deck
              </label>
              <span className={styles.deckLine}>
                <select
                  id="ranking-deck"
                  value={deckId ?? ""}
                  onChange={(e) =>
                    update({}, filterState, e.target.value || undefined)
                  }
                >
                  <option value="">None</option>
                  {deckList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {deck && rules && (
                  <span className={styles.muted}>
                    {deckCardCount} of {rules.deckMin} deck cards
                  </span>
                )}
                {deck && (
                  <Link to="/decks/$deckId" params={{ deckId: deck.id }}>
                    Open
                  </Link>
                )}
                {deckList.length === 0 && (
                  <Link to="/decks">Create a deck</Link>
                )}
              </span>
              {deckError && <p role="alert">{deckError}</p>}
            </div>
          )}
          <Button
            className={styles.buildButton}
            aria-expanded={building}
            onClick={() => setBuilding(!building)}
          >
            Build a core
          </Button>
        </section>

        <div className={building ? styles.withBuilder : undefined}>
          <div>
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="Ranked cards"
            >
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`ranking-tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls={`ranking-panel-${t.id}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label} <span className={styles.count}>{t.count}</span>
                </button>
              ))}
            </div>

            <div
              role="tabpanel"
              id={`ranking-panel-${tab}`}
              aria-labelledby={`ranking-tab-${tab}`}
            >
              {tab === "deck" && (
                <>
                  <table className={styles.table}>
                    <caption className={styles.visuallyHidden}>
                      Ranked by your priorities
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">
                          <span className={styles.visuallyHidden}>Picture</span>
                        </th>
                        <th scope="col">Card</th>
                        <th scope="col">Floor · overall · ceiling</th>
                        <th scope="col" className={styles.value}>
                          Value
                        </th>
                        <th scope="col">
                          <span className={styles.visuallyHidden}>Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ordered.length === 0 && (
                        <tr>
                          <td colSpan={6} className={styles.empty}>
                            <strong>Nothing ranked yet</strong>
                            <span>
                              Cards appear here once {data.minRatingCount}{" "}
                              scorers have reviewed them, or once you have.
                              Filters can hide them too.
                            </span>
                            <Link to="/needs-review">Review cards</Link>
                          </td>
                        </tr>
                      )}
                      {ordered.flatMap((r, i) => [
                        ...(i === settings.coreSize
                          ? [
                              <tr key="cut-off" className={styles.cutOff}>
                                <td colSpan={6}>
                                  <span>Core cut-off</span>
                                </td>
                              </tr>,
                            ]
                          : []),
                        deckRow(r, i),
                      ])}
                    </tbody>
                  </table>
                  <p className={styles.footnote}>
                    Value is where each card sits between its floor and ceiling
                    for your play style. Cards need at least{" "}
                    {data.minRatingCount} community ratings, or your own review,
                    to be ranked. Synergy joins the ranking in phase two.
                  </p>
                </>
              )}

              {tab === "gear" &&
                (gearGroups.length === 0 ? (
                  <p className={styles.muted}>
                    No weapons or equipment ranked yet.
                  </p>
                ) : (
                  <>
                    <p className={styles.muted}>
                      They don't take deck space, so they're ranked by slot.
                    </p>
                    <div className={styles.gear}>
                      {gearGroups.map((g) => (
                        <table key={g.title} className={styles.slot}>
                          <caption>{g.title}</caption>
                          <tbody>
                            {g.rows.slice(0, 3).map((r, i) => (
                              <tr key={r.variantId}>
                                <td className={styles.thumbCell}>
                                  <Thumb
                                    variant={
                                      variantsById.get(r.variantId)?.variant
                                    }
                                  />
                                </td>
                                <td className={styles.cardCell}>
                                  <span className={styles.nameLine}>
                                    {cardLink(r, r.name)}
                                  </span>
                                  <span className={styles.meta}>
                                    {i === 0 && (
                                      <Tag tone="accent">Top pick</Tag>
                                    )}{" "}
                                    {inDeckTag(r.variantId)}
                                  </span>
                                </td>
                                <td className={styles.value}>
                                  {Math.round(r.value)}
                                </td>
                                <td className={styles.actions}>
                                  {addButton(r.variantId, r.name)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ))}
                    </div>
                  </>
                ))}

              {tab === "excluded" &&
                (excludedRows.length === 0 ? (
                  <p className={styles.muted}>
                    Nothing excluded. Use × on a card to leave it out of the
                    ranking.
                  </p>
                ) : (
                  <ul className={styles.excluded}>
                    {excludedRows.map((r) => {
                      const name = nameOf(r);
                      return (
                        <li key={r.variantId}>
                          <Thumb
                            variant={variantsById.get(r.variantId)?.variant}
                          />
                          <span>{name}</span>
                          <Button
                            variant="ghost"
                            onClick={() => restore(r.variantId)}
                            aria-label={`Restore ${name}`}
                          >
                            Restore
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ))}
            </div>
          </div>
          {building && rules && (
            <CoreBuilder
              key={deck?.id ?? "none"}
              ranked={deckRows.map((r) => ({ ...r, name: nameOf(r) }))}
              copyLimit={rules.copyLimit}
              initialLocked={
                new Map([
                  ...pinned.map((id): [string, number] => [
                    id,
                    rules.copyLimit,
                  ]),
                  ...[...inDeck].filter(([id]) => !excluded.has(id)),
                ])
              }
              deck={deck}
              signedIn={!!user}
              onAddToDeck={addCoreToDeck}
              onSaveAsDeck={saveCoreAsDeck}
              onClose={() => setBuilding(false)}
            />
          )}
        </div>
      </FilteredLayout>
    </>
  );
}
