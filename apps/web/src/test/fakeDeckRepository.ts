import type {
  Deck,
  DeckRepository,
  Hero,
  Matchup,
  PlanGoal,
  DeckVersion,
  VersionGame,
} from "../decks/deckRepository.ts";
import type { FormatRules } from "../decks/deckRules.ts";
import { sampleCards } from "./fakeCardRepository.ts";

export const sampleRules: FormatRules = {
  copyLimit: 3,
  deckMin: 60,
  poolMax: 80,
  weaponHands: 2,
};

/** A deck for tests: private and owned by u1 unless it says otherwise. */
export type DeckFixture = Omit<Deck, "visibility" | "ownerId"> &
  Partial<Pick<Deck, "visibility" | "ownerId">>;

/** An in-memory DeckRepository; `saved` records every write. New decks belong to `userId`. */
export function fakeDeckRepository(
  initial: DeckFixture[] = [],
  options: {
    userId?: string;
    heroes?: Hero[];
    matchups?: Matchup[];
    goals?: PlanGoal[];
    versions?: DeckVersion[];
  } = {},
) {
  let versions: DeckVersion[] = [...(options.versions ?? [])];
  let games: VersionGame[] = [];
  let nextGame = 0;
  let matchups = [...(options.matchups ?? [])];
  let nextMatchup = 0;
  let goals = [...(options.goals ?? [])];
  let nextGoal = 0;
  let decks: Deck[] = initial.map((d) => ({
    visibility: "private",
    ownerId: "u1",
    ...d,
    cards: [...d.cards],
  }));
  const summary = ({ pitchTargets: _, ...d }: Deck) => d;
  const saved: string[] = [];
  const repository: DeckRepository = {
    listVersions: async (deckId) =>
      versions
        .filter((v) => v.deckId === deckId)
        .sort((a, b) => b.number - a.number),
    async saveVersion(deckId) {
      saved.push(`version ${deckId}`);
      const deck = decks.find((d) => d.id === deckId)!;
      const version: DeckVersion = {
        id: `version-${versions.length + 1}`,
        deckId,
        number: versions.filter((v) => v.deckId === deckId).length + 1,
        createdAt: "2026-10-23T12:00:00Z",
        fabraryUrl: null,
        snapshot: {
          schemaVersion: 1,
          name: deck.name,
          hero: "Viserai, the Forsaken",
          format: "Classic Constructed",
          pitchTargets: { ...deck.pitchTargets },
          cards: deck.cards.map((entry) => {
            const card = sampleCards.find((card) =>
              card.variants.some((variant) => variant.id === entry.variantId),
            )!;
            const variant = card.variants.find(
              (variant) => variant.id === entry.variantId,
            )!;
            return {
              ...entry,
              externalId: entry.variantId,
              name: card.name,
              pitch: variant.pitch,
              type: card.type,
              subtypes: [...card.subtypes],
            };
          }),
          loadouts: matchups
            .filter((matchup) => matchup.deckId === deckId)
            .map((matchup) => ({
              id: matchup.id,
              name: matchup.name,
              isDefault: false,
              opponentHeroId: matchup.heroId,
              opponentHeroName:
                options.heroes?.find((hero) => hero.id === matchup.heroId)
                  ?.name ?? null,
              cards: matchup.cards.map((card) => ({ ...card })),
            })),
        },
      };
      versions = [version, ...versions];
      return version;
    },
    async setVersionLink(id, url) {
      saved.push(`version link ${id} ${url ?? ""}`);
      versions = versions.map((v) =>
        v.id === id ? { ...v, fabraryUrl: url } : v,
      );
    },
    listGames: async (versionId) =>
      games.filter((game) => game.versionId === versionId),
    async addGame(versionId, game) {
      saved.push(`game ${versionId} ${game.fileName ?? ""}`);
      const added: VersionGame = {
        id: `game-${++nextGame}`,
        versionId,
        uploadedAt: "2026-10-28T12:00:00Z",
        ...game,
      };
      games = [added, ...games];
      return added;
    },
    async deleteGame(id) {
      saved.push(`game delete ${id}`);
      games = games.filter((game) => game.id !== id);
    },
    listMyDecks: async (userId) =>
      decks.filter((d) => d.ownerId === userId).map(summary),
    listPublicDecks: async () =>
      decks.filter((d) => d.visibility === "public").map(summary),
    async createDeck(name, createOptions) {
      const visibility = createOptions?.visibility ?? "private";
      saved.push(
        `create ${name}${visibility === "private" ? "" : ` ${visibility}`}`,
      );
      const deck: Deck = {
        id: `deck-${decks.length + 1}`,
        name,
        updatedAt: "2026-10-14T12:00:00Z",
        visibility,
        ownerId: options.userId ?? "u1",
        cards: [],
        pitchTargets: {},
      };
      decks = [...decks, deck];
      return summary(deck);
    },
    async setVisibility(deckId, visibility) {
      saved.push(`${visibility} ${deckId}`);
      decks = decks.map((d) => (d.id === deckId ? { ...d, visibility } : d));
    },
    async renameDeck(deckId, name) {
      saved.push(`rename ${deckId} ${name}`);
      decks = decks.map((d) => (d.id === deckId ? { ...d, name } : d));
    },
    async deleteDeck(deckId) {
      saved.push(`delete ${deckId}`);
      decks = decks.filter((d) => d.id !== deckId);
    },
    getDeck: async (id) => decks.find((d) => d.id === id) ?? null,
    async setCard(deckId, card) {
      saved.push(
        `set ${deckId} ${card.variantId} ${card.quantity} ${card.sideboard ? "side" : "main"}`,
      );
      decks = decks.map((d) =>
        d.id !== deckId
          ? d
          : {
              ...d,
              cards: [
                ...d.cards.filter(
                  (c) =>
                    c.variantId !== card.variantId ||
                    c.sideboard !== card.sideboard,
                ),
                ...(card.quantity > 0 ? [card] : []),
              ],
            },
      );
    },
    async replaceCards(deckId, cards) {
      saved.push(
        `replace ${deckId} ${cards
          .map(
            (c) => `${c.variantId}:${c.quantity}${c.sideboard ? ":side" : ""}`,
          )
          .join(",")}`,
      );
      decks = decks.map((d) =>
        d.id === deckId ? { ...d, cards: cards.map((c) => ({ ...c })) } : d,
      );
    },
    async setPitchTargets(deckId, targets) {
      saved.push(
        `targets ${deckId} ${Object.entries(targets)
          .map(([p, n]) => `${p}:${n}`)
          .join(",")}`,
      );
      decks = decks.map((d) =>
        d.id === deckId ? { ...d, pitchTargets: targets } : d,
      );
    },
    getFormatRules: async () => sampleRules,
    listHeroes: async () => [...(options.heroes ?? [])],
    listMatchups: async (deckId) => matchups.filter((m) => m.deckId === deckId),
    async saveMatchup(deckId, plan) {
      const { heroId } = plan;
      const kept = plan.cards.filter((c) => c.quantity > 0);
      saved.push(
        `matchup ${deckId} ${heroId ?? "custom"} ${[...kept]
          .sort((a, b) => a.variantId.localeCompare(b.variantId))
          .map((c) => `${c.variantId}:${c.quantity}`)
          .join(",")}`,
      );
      const existing = matchups.find(
        (m) => m.deckId === deckId && m.id === plan.id,
      );
      const matchup: Matchup = {
        id: existing?.id ?? `matchup-${++nextMatchup}`,
        deckId,
        name: plan.name.trim(),
        heroId,
        cards: kept,
      };
      matchups = [...matchups.filter((m) => m.id !== matchup.id), matchup];
      return matchup;
    },
    async deleteMatchup(id) {
      saved.push(`delete matchup ${id}`);
      matchups = matchups.filter((m) => m.id !== id);
      goals = goals.filter((g) => g.planId !== id);
    },
    listPlanGoals: async (planId) => goals.filter((g) => g.planId === planId),
    async addPlanGoal(goal) {
      saved.push(
        `goal ${goal.planId} ${goal.scenarioId ?? goal.builtIn} ${goal.target}`,
      );
      if (
        goals.some(
          (g) =>
            g.planId === goal.planId &&
            g.scenarioId === goal.scenarioId &&
            g.builtIn === goal.builtIn,
        )
      )
        throw Object.assign(new Error("duplicate"), { code: "23505" });
      const added = { ...goal, id: `goal-${++nextGoal}` };
      goals = [...goals, added];
      return added;
    },
    async deletePlanGoal(id) {
      saved.push(`delete goal ${id}`);
      goals = goals.filter((g) => g.id !== id);
    },
  };
  return { repository, saved };
}
