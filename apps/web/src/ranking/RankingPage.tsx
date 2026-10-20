import { deriveSynergies, rolesOf, type RoleId } from "@vdb/cards";
import type { CommunityEdgeRow, CommunityFeedbackRow } from "@vdb/scoring";
import { copyLimitFor } from "../decks/deckRules.ts";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CardModal } from "../cards/CardModal.tsx";
import type { CardSummary } from "../cards/cardRepository.ts";
import { pitchName } from "../cards/pitch.ts";
import { useCards } from "../cards/useCards.ts";
import type {
  Deck,
  DeckSummary,
  PitchTargets,
} from "../decks/deckRepository.ts";
import type { FormatRules } from "../decks/deckRules.ts";
import { useAppSelector } from "../hooks.ts";
import type { Dimension, ScoreRow } from "../scoring/scoreRepository.ts";
import { useServices } from "../servicesContext.ts";
import { CoreRail, type TrayCard } from "./CoreRail.tsx";
import { ReadingsTab } from "./ReadingsTab.tsx";
import { runScenarios } from "./runScenarios.ts";
import { RUNS, type ScenarioOutput } from "./scenarioRuns.ts";
import { toEngineCard } from "./scenarios.ts";
import { SetupTab } from "./SetupTab.tsx";
import type {
  CommunityAnswer,
  StrategyQuestion,
} from "../strategy/strategyRepository.ts";
import { EngineBoard, type BoardCard, type GearSlot } from "./EngineBoard.tsx";
import {
  engineOrder,
  EXAMPLE_TARGETS,
  inLane,
  partners,
  type HeroSide,
} from "./engines.ts";
import { rankVariants, type CommunityRow } from "./rank.ts";
import {
  readRankingSearch,
  writeRankingSearch,
  type RankingSettings,
} from "./rankingSearch.ts";
import { preferenceBoost } from "./preferences.ts";
import { offPitchReactions, suggestCore, suggestGear } from "./suggestCore.ts";
import {
  lowValueGenerator,
  withGeneratorPenalty,
} from "./lowValueGenerator.ts";
import { ScopedSynergies } from "../synergy/SynergyExplorer.tsx";
import {
  buildSynergyGraph,
  fillWithSynergy,
  synergyBonus,
  type SynergyInput,
} from "./synergyCore.ts";
import { LoadError, Loading } from "../ui/index.ts";
import styles from "./RankingPage.module.css";

const route = getRouteApi("/core");
const GEAR = ["weapon", "equipment"];
const SLOTS = ["Head", "Chest", "Arms", "Legs", "Off-Hand"];

interface Data {
  dimensions: Dimension[];
  community: CommunityRow[];
  minRatingCount: number;
  mine?: {
    rows: (ScoreRow & { cardId: string })[];
    reviewedCardIds: Set<string>;
  };
}

type Tab = "setup" | "board" | "synergies" | "readings";
const TABS: { id: Tab; label: string }[] = [
  { id: "setup", label: "Set up" },
  { id: "board", label: "Board" },
  { id: "synergies", label: "Synergies" },
  { id: "readings", label: "Readings" },
];

const sideOf = (sideFocus: number): HeroSide =>
  sideFocus <= 25 ? "forsaken" : sideFocus >= 75 ? "usurper" : "both";

const roleCard = (c: CardSummary) => ({
  type: c.type,
  subtypes: c.subtypes,
  attributes: c.attributes,
  variantAttributes: c.variants.map((v) => v.attributes),
});

/**
 * The engine board: ranked cards laid out by the engine they feed (makers beside what uses
 * them), with a core built beside it. Fits are mechanical links from card roles
 * (docs/roles.md, unverified), shown beside the scores and never blended into them.
 */
export function RankingPage() {
  const { status, items, retry } = useCards();
  const { scores, decks, strategy, synergy } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const search = route.useSearch();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  // Rule weights and the scoring group's links, loaded once synergy strength is turned up.
  const [synergyData, setSynergyData] = useState<{
    weights: Record<string, number>;
    edges: CommunityEdgeRow[];
    feedback: CommunityFeedbackRow[];
  } | null>(null);
  const [scoresFailed, setScoresFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const deckId = typeof search.deck === "string" ? search.deck : undefined;
  const [deckList, setDeckList] = useState<DeckSummary[]>([]);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [rules, setRules] = useState<FormatRules | null>(null);
  const [targets, setTargets] = useState<PitchTargets>(EXAMPLE_TARGETS);
  const [query, setQuery] = useState("");
  const [questions, setQuestions] = useState<StrategyQuestion[]>([]);
  const [myAnswers, setMyAnswers] = useState<Record<string, number>>({});
  const [scenarioRun, setScenarioRun] = useState<{
    output: ScenarioOutput;
    signature: string;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [community, setCommunity] = useState<Record<string, CommunityAnswer>>(
    {},
  );

  useEffect(() => {
    let live = true;
    Promise.all([
      strategy.listQuestions(),
      strategy.listCommunityAnswers(),
      user ? strategy.listMyAnswers(user.id) : Promise.resolve({}),
    ]).then(
      ([q, c, mine]) => {
        if (!live) return;
        setQuestions(q);
        setCommunity(c);
        setMyAnswers(mine);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [strategy, user]);

  useEffect(() => {
    let live = true;
    decks.getFormatRules().then(
      (r) => live && setRules(r),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [decks]);

  useEffect(() => {
    if (!user) return;
    let live = true;
    decks.listMyDecks(user.id).then(
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
    decks.getDeck(deckId).then(
      (d) => {
        if (!live) return;
        setDeck(d);
        if (d && Object.keys(d.pitchTargets).length > 0) {
          setTargets(d.pitchTargets);
        }
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [decks, user, deckId]);

  useEffect(() => {
    let live = true;
    setScoresFailed(false);
    Promise.all([
      scores.listDimensions(),
      scores.listCommunityScores(),
      scores.getMinRatingCount(),
      user ? scores.listAllMyScores(user.id) : Promise.resolve(null),
      user ? scores.listMyReviewedCardIds(user.id) : Promise.resolve(null),
    ]).then(
      ([dimensions, community, minRatingCount, myRows, reviewed]) => {
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
      },
      () => live && setScoresFailed(true),
    );
    return () => {
      live = false;
    };
  }, [scores, user, attempt]);

  const settings = readRankingSearch(search);
  const synergyOn = settings.synergy > 0;
  useEffect(() => {
    if (!synergyOn || synergyData) return;
    let live = true;
    Promise.all([
      synergy.listRuleWeights(),
      synergy.listCommunitySynergies(),
    ]).then(
      ([weights, community]) =>
        live && setSynergyData({ weights, ...community }),
      // Synergy only adds to the ranking: without it, rules use their defaults.
      () => live && setSynergyData({ weights: {}, edges: [], feedback: [] }),
    );
    return () => {
      live = false;
    };
  }, [synergy, synergyOn, synergyData]);
  // Set up is step 1, so it's where the page opens; the other tabs are kept in the URL.
  const tab: Tab = TABS.some((t) => t.id === search.tab)
    ? (search.tab as Tab)
    : "setup";
  const update = (
    patch: Partial<RankingSettings>,
    deckChoice = deckId,
    tabChoice = tab,
  ) =>
    void navigate({
      to: ".",
      replace: true,
      resetScroll: false,
      search: {
        ...writeRankingSearch({ ...settings, ...patch }),
        ...(deckChoice ? { deck: deckChoice } : {}),
        ...(tabChoice !== "setup" ? { tab: tabChoice } : {}),
      },
    });
  const setTab = (t: Tab) => update({}, deckId, t);

  async function answer(key: string, n: number) {
    if (!user) return;
    const previous = myAnswers;
    setMyAnswers({ ...myAnswers, [key]: n });
    try {
      await strategy.setAnswer(user.id, key, n);
      // A scorer's answer counts towards the group's average straight away.
      setCommunity(await strategy.listCommunityAnswers());
    } catch {
      setMyAnswers(previous);
    }
  }

  const cardsById = useMemo(
    () => new Map(items.map((c) => [c.id, c])),
    [items],
  );
  const rolesById = useMemo(
    () =>
      new Map<string, RoleId[]>(items.map((c) => [c.id, rolesOf(roleCard(c))])),
    [items],
  );

  const synergyInput = useMemo((): SynergyInput | null => {
    if (!synergyOn) return null;
    const weights = synergyData?.weights ?? {};
    return {
      derived: deriveSynergies(
        items.map((c) => ({ ...roleCard(c), id: c.id, name: c.name })),
        weights,
      ),
      ruleWeights: weights,
      feedback: synergyData?.feedback ?? [],
      community: synergyData?.edges ?? [],
    };
  }, [items, synergyOn, synergyData]);
  const synergyGraph = useMemo(
    () => (synergyOn && synergyInput ? buildSynergyGraph(synergyInput) : null),
    [synergyOn, synergyInput],
  );

  const ranked = useMemo((): BoardCard[] => {
    if (!data) return [];
    return rankVariants({
      variants: items.flatMap((c) =>
        c.variants.map((v) => ({
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
    }).map((r) => {
      const card = cardsById.get(r.cardId)!;
      return {
        ...r,
        label:
          card.variants.length > 1
            ? `${r.name} (${pitchName(r.pitch).toLowerCase()})`
            : r.name,
        roles: rolesById.get(r.cardId) ?? [],
        type: card.type,
        imageUrl: card.variants.find((v) => v.id === r.variantId)?.imageUrl,
      };
    });
  }, [data, items, cardsById, rolesById, JSON.stringify(settings)]);

  if (status === "failed")
    return <LoadError what="the cards" onRetry={retry} />;
  if (scoresFailed)
    return (
      <LoadError what="the scores" onRetry={() => setAttempt((n) => n + 1)} />
    );
  if (status !== "loaded") return <Loading label="Loading the cards" />;
  if (!data) return <Loading label="Loading the scores" />;

  const copyLimit = rules?.copyLimit ?? 1;
  const byVariant = new Map(ranked.map((r) => [r.variantId, r]));
  /** A card's own copy limit: one for a Legendary card or equipment (deckRules). */
  const limitOf = (variantId: string) => {
    const card = cardsById.get(byVariant.get(variantId)?.cardId ?? "");
    return card && rules ? copyLimitFor(card, rules) : copyLimit;
  };
  const deckCards = ranked.filter((r) => !GEAR.includes(r.type));
  const q = query.trim().toLowerCase();
  const shown = q
    ? deckCards.filter((r) => r.name.toLowerCase().includes(q))
    : deckCards;
  const gearCards = ranked.filter((r) => GEAR.includes(r.type));
  const gear: GearSlot[] = [
    {
      title: "Weapons",
      cards: gearCards.filter((r) => r.type === "weapon"),
    },
    ...SLOTS.map((slot) => ({
      title: slot,
      cards: gearCards.filter((r) =>
        cardsById.get(r.cardId)?.subtypes.includes(slot),
      ),
    })),
  ].filter((g) => g.cards.length > 0);

  const core: TrayCard[] = Object.entries(settings.core)
    .map(([variantId, quantity]): TrayCard | null => {
      const r = byVariant.get(variantId);
      return r
        ? {
            variantId,
            name: r.name,
            label: r.label,
            pitch: r.pitch,
            value: r.value,
            roles: r.roles,
            quantity: Math.min(quantity, rules ? limitOf(variantId) : quantity),
            limit: limitOf(variantId),
          }
        : null;
    })
    .filter((c): c is TrayCard => !!c);
  const setCore = (next: Record<string, number>) => update({ core: next });
  const setQuantity = (variantId: string, quantity: number) => {
    const next = { ...settings.core };
    if (quantity <= 0) delete next[variantId];
    else next[variantId] = Math.min(quantity, limitOf(variantId));
    setCore(next);
  };
  const toggleCore = (c: BoardCard) =>
    setQuantity(
      c.variantId,
      settings.core[c.variantId] ? 0 : limitOf(c.variantId),
    );

  // Deck cards only: weapons and equipment aren't among the 60.
  const coreTotal = core
    .filter((c) => !gearCards.some((g) => g.variantId === c.variantId))
    .reduce((n, c) => n + c.quantity, 0);
  // What a scenario run used, so a later change to the core can be spotted.
  const coreSignature = JSON.stringify(
    core.map((c) => [c.variantId, c.quantity]).sort(),
  );
  function runAllScenarios(seed: number) {
    const engineCore = core.flatMap((c) => {
      const r = byVariant.get(c.variantId);
      const card = r && cardsById.get(r.cardId);
      const variant = card?.variants.find((v) => v.id === c.variantId);
      return card && variant
        ? [{ card: toEngineCard(card, variant, c.roles), copies: c.quantity }]
        : [];
    });
    setRunning(true);
    const signature = coreSignature;
    runScenarios({
      core: engineCore,
      deckSize: rules?.deckMin ?? 60,
      runs: RUNS,
      seed,
    }).then(
      (output) => {
        setScenarioRun({ output, signature });
        setRunning(false);
      },
      () => setRunning(false),
    );
  }
  const pitchCounts: Record<number, number> = {};
  for (const c of core) {
    if (c.pitch !== null) {
      pitchCounts[c.pitch] = (pitchCounts[c.pitch] ?? 0) + c.quantity;
    }
  }

  const isLowValue = (cardId: string, variantId: string) => {
    const card = cardsById.get(cardId);
    const variant = card?.variants.find((v) => v.id === variantId);
    return !!card && !!variant && lowValueGenerator(card, variant);
  };
  // Fill each pitch to its target: cards already in the core stay, the rest come best fits first.
  /** The core filled to the pitch targets; cards already in it stay. */
  function filled(): Record<string, number> {
    // In the board's order: preferences always, fits first when the board is ordered by them.
    // Defence reactions are suggested at their best defence only (the maintainer, 20 Oct 2026).
    const offPitch = offPitchReactions(items);
    const candidates = [...deckCards]
      .map((r) => ({
        r,
        // One-and-done Runechant makers, like blue Runeblood Incantation, go lower (20 Oct 2026).
        key: withGeneratorPenalty(
          r.value + preferenceBoost(r.roles, settings.prefs),
          isLowValue(r.cardId, r.variantId),
        ),
        fits: partners(r.name, r.roles, core).length,
      }))
      .sort((a, b) =>
        settings.order === "fits"
          ? b.fits - a.fits || b.key - a.key
          : b.key - a.key,
      )
      .map(({ r, key }) => ({
        ...r,
        key,
        limit: limitOf(r.variantId),
        notSuggested: offPitch.has(r.variantId),
      }));
    const constraints = {
      targets,
      copiesEach: copyLimit,
      copyLimit,
      locked: new Map(core.map((c) => [c.variantId, c.quantity])),
      removed: new Set<string>(),
    };
    // With synergy on, pick one card at a time by value, preferences and synergy with the
    // cards already picked (docs/synergy-rules.md "Synergy in the ranking").
    const graph = synergyGraph;
    const s = graph
      ? fillWithSynergy(
          candidates.map((c) => ({ ...c, value: c.key })),
          constraints,
          (cardId, picked) =>
            synergyBonus(cardId, picked, graph, settings.synergy / 10),
        )
      : suggestCore(candidates, constraints);
    // Gear already in the core stays; with Suggest equipment on, empty slots get their best card.
    const picks = Object.fromEntries([
      ...s.picks.map((p) => [p.variantId, p.quantity] as const),
      ...Object.entries(settings.core).filter(([id]) =>
        gearCards.some((g) => g.variantId === id),
      ),
    ]);
    // Two-handed weapons take the off-hand too.
    const twoHanded = new Set(
      gearCards
        .filter((g) => cardsById.get(g.cardId)?.subtypes.includes("2H"))
        .map((g) => g.variantId),
    );
    return settings.suggestGear ? suggestGear(gear, picks, twoHanded) : picks;
  }

  async function addCore(id: string, start: Deck["cards"]) {
    let cards = start;
    for (const c of core) {
      const existing = cards.find((d) => d.variantId === c.variantId);
      if ((existing?.quantity ?? 0) >= c.quantity) continue;
      const card = {
        variantId: c.variantId,
        quantity: c.quantity,
        sideboard: existing?.sideboard ?? false,
      };
      await decks.setCard(id, card);
      cards = [...cards.filter((d) => d.variantId !== c.variantId), card];
    }
    return cards;
  }

  // The board in reading order: each engine's makers then users, then the rest. The pop-over
  // steps through it.
  const engines = engineOrder(sideOf(settings.sideFocus));
  const stops = [
    ...new Set(
      [
        ...engines.flatMap((e) =>
          (["generator", "payoff"] as const).flatMap((kind) =>
            shown.filter((r) => inLane(r.roles, e.id, kind)),
          ),
        ),
        ...shown,
      ].map((r) => r.variantId),
    ),
  ];
  const openCard =
    typeof search.card === "string" ? cardsById.get(search.card) : undefined;
  const openVariant =
    typeof search.variant === "string" ? search.variant : undefined;
  const at = openVariant ? stops.indexOf(openVariant) : -1;
  const goTo = (variantId: string | undefined) => {
    const r = variantId && byVariant.get(variantId);
    if (!r) return;
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
  };
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

  return (
    <>
      {openCard && (
        <CardModal
          cardId={openCard.id}
          name={openCard.name}
          verified={openCard.attributesVerified}
          position={
            at >= 0 ? { index: at + 1, total: stops.length } : undefined
          }
          variantId={openVariant}
          onPrevious={at > 0 ? () => goTo(stops[at - 1]) : undefined}
          onNext={
            at >= 0 && stops[at + 1] ? () => goTo(stops[at + 1]) : undefined
          }
          onNextCard={
            at >= 0
              ? () =>
                  goTo(
                    stops
                      .slice(at + 1)
                      .find((id) => byVariant.get(id)?.cardId !== openCard.id),
                  )
              : undefined
          }
          onChooseVariant={(variantId) => goTo(variantId)}
          onClose={closeCard}
        />
      )}
      <div className={styles.buildHead}>
        <div className={styles.buildRow}>
          <h1>Build a core</h1>
          <div className={styles.summary}>
            <span className={styles.summaryCount}>
              {rules?.deckMin
                ? `${coreTotal} of ${rules.deckMin} deck cards`
                : `${coreTotal} deck cards`}
            </span>
            <span className={styles.miniMix} aria-hidden="true">
              {[1, 2, 3].map((p) => (
                <i
                  key={p}
                  style={{
                    flexGrow: pitchCounts[p] ?? 0,
                    background: `var(--pitch-${p})`,
                  }}
                />
              ))}
            </span>
            <span className={styles.mixText}>
              {[1, 2, 3]
                .map(
                  (p) => `${pitchCounts[p] ?? 0} ${pitchName(p).toLowerCase()}`,
                )
                .join(" · ")}
            </span>
          </div>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="Build steps">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`build-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`build-panel-${t.id}`}
              onClick={() => setTab(t.id)}
            >
              <span className={styles.step} aria-hidden="true">
                {i + 1}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`build-panel-${tab}`}
        aria-labelledby={`build-tab-${tab}`}
        className={styles.tabPanel}
      >
        {tab === "setup" && (
          <SetupTab
            settings={settings}
            onSettings={(patch) => update(patch)}
            showBlend={!!data.mine}
            targets={targets}
            onTargets={setTargets}
            pitchCounts={pitchCounts}
            // One navigation, so the tab change can't overwrite the new core.
            onBuild={() => update({ core: filled() }, deckId, "board")}
            questions={questions}
            myAnswers={myAnswers}
            community={community}
            signedIn={!!user}
            onAnswer={(key, n) => void answer(key, n)}
            onSkip={() => setTab("board")}
          />
        )}
        {tab === "synergies" && (
          <ScopedSynergies
            scope={{
              // Straight from the core, ranked or not.
              cardIds: items
                .filter((c) => c.variants.some((v) => settings.core[v.id]))
                .map((c) => c.id),
              label: "your core",
            }}
            empty="Add cards to your core to see how they link."
          />
        )}
        {tab === "readings" && (
          <ReadingsTab
            cards={core}
            output={scenarioRun?.output ?? null}
            stale={!!scenarioRun && scenarioRun.signature !== coreSignature}
            running={running}
            onRun={runAllScenarios}
          />
        )}
        {tab === "board" && (
          <div className={styles.page}>
            <div className={styles.main}>
              <div className={styles.boardBar}>
                <input
                  type="search"
                  className={styles.search}
                  aria-label="Find a card"
                  placeholder="Find a card"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className={styles.orderControl}>
                  <span className={styles.label}>Order</span>
                  <div
                    className={styles.presets}
                    role="group"
                    aria-label="Order"
                  >
                    {(
                      [
                        ["score", "Score"],
                        ["fits", "Best fits first"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={settings.order === value}
                        onClick={() => update({ order: value })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <span className={styles.boardCount}>
                  {deckCards.length.toLocaleString("en-GB")} ranked
                </span>
              </div>

              {deckCards.length === 0 ? (
                <div className={styles.empty}>
                  <strong>Nothing ranked yet</strong>
                  <span>
                    Cards appear here once {data.minRatingCount} scorers have
                    reviewed them, or once you have.
                  </span>
                  <Link to="/needs-review">Review cards</Link>
                </div>
              ) : (
                <EngineBoard
                  engines={engines}
                  cards={shown}
                  gear={gear}
                  core={core}
                  inDeck={
                    new Map(
                      (deck?.cards ?? []).map((c) => [c.variantId, c.quantity]),
                    )
                  }
                  order={settings.order}
                  prefs={settings.prefs}
                  onToggleCore={toggleCore}
                  onOpen={(c) => goTo(c.variantId)}
                />
              )}
              <p className={styles.footnote}>
                “Fits” links come from card roles (docs/roles.md), a first pass
                that hasn't been checked by an experienced player. They never
                change a card's score.
              </p>
            </div>

            <CoreRail
              cards={core}
              copyLimit={copyLimit}
              onQuantity={setQuantity}
              signedIn={!!user}
              deck={deck}
              deckId={deckId}
              deckList={deckList}
              onChooseDeck={(id) => update({}, id)}
              onAddToDeck={async () => {
                if (!deck) return;
                const cards = await addCore(deck.id, deck.cards);
                setDeck({ ...deck, cards });
              }}
              onSaveAsDeck={async (name) => {
                const created = await decks.createDeck(name);
                await addCore(created.id, []);
                // The Set up targets go with it, for the deck's Stats.
                await decks.setPitchTargets(created.id, targets);
                setDeckList([created, ...deckList]);
                update({}, created.id);
                return created;
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
