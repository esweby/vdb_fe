import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import type { CardSummary, VariantSummary } from "../cards/cardRepository.ts";
import { pitchesShown, pitchName } from "../cards/pitch.ts";
import { useCards } from "../cards/useCards.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { Button, Dialog, TextField } from "../ui/index.ts";
import ui from "../ui/ui.module.css";
import type { DeckSummary, Visibility } from "./deckRepository.ts";
import type { FormatRules } from "./deckRules.ts";
import styles from "./DecksPage.module.css";
import { VISIBILITIES, visibilityLabel } from "./visibility.ts";

const route = getRouteApi("/decks");
const GEAR = ["weapon", "equipment"];
const linkButton = (variant: "primary" | "secondary") =>
  [ui.button, ui[variant]].filter(Boolean).join(" ");

/** "today", "yesterday", "3 days ago". */
function updatedAgo(iso: string, now = Date.now()) {
  const days = Math.round((now - new Date(iso).getTime()) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  if (days < 7) return rtf.format(-days, "day");
  if (days < 60) return rtf.format(-Math.round(days / 7), "week");
  return rtf.format(-Math.round(days / 30), "month");
}

type Lookup = Map<string, { card: CardSummary; variant: VariantSummary }>;

function DeckTile(props: {
  deck: DeckSummary;
  lookup: Lookup;
  yours: boolean;
  canChangeVisibility: boolean;
  onVisibility: (visibility: Visibility) => void;
}) {
  const { deck, lookup } = props;
  // Deck cards only: no sideboard, and weapons and equipment don't take deck space.
  const main = deck.cards
    .filter((c) => !c.sideboard)
    .map((c) => ({ ...c, found: lookup.get(c.variantId) }))
    .filter((c) => c.found && !GEAR.includes(c.found.card.type));
  const count = main.reduce((n, c) => n + c.quantity, 0);
  const counts: Record<number, number> = {};
  for (const c of main) {
    const p = c.found!.variant.pitch;
    if (p !== null) counts[p] = (counts[p] ?? 0) + c.quantity;
  }
  const byPitch = pitchesShown(counts).map((p) => [p, counts[p] ?? 0]);
  // The cover is the card the deck runs most of, with an image.
  const cover = [...main]
    .sort((a, b) => b.quantity - a.quantity)
    .find((c) => c.found!.variant.imageUrl)?.found;

  return (
    <li aria-label={deck.name} className={styles.tile}>
      <Link
        to="/decks/$deckId"
        params={{ deckId: deck.id }}
        className={styles.cover}
        tabIndex={-1}
        aria-hidden="true"
      >
        {cover ? (
          <img src={cover.variant.imageUrl!} alt="" loading="lazy" />
        ) : (
          <span className={styles.coverEmpty}>{deck.name.charAt(0)}</span>
        )}
      </Link>
      <div className={styles.body}>
        <h2 className={styles.name}>
          <Link to="/decks/$deckId" params={{ deckId: deck.id }}>
            {deck.name}
          </Link>
        </h2>
        <p className={styles.meta}>
          <span>{`${count} cards`}</span>
          <span aria-hidden="true">·</span>
          <span>Updated {updatedAgo(deck.updatedAt)}</span>
          {!props.yours && deck.ownerName && (
            <>
              <span aria-hidden="true">·</span>
              <span>by {deck.ownerName}</span>
            </>
          )}
        </p>
        <span
          className={styles.mix}
          role="img"
          aria-label={`Pitch mix: ${byPitch
            .map(([p, n]) => `${n} ${pitchName(p!).toLowerCase()}`)
            .join(", ")}`}
        >
          {count === 0 ? (
            <i className={styles.mixEmpty} />
          ) : (
            byPitch.map(([p, n]) => (
              <i
                key={p}
                style={{ flexGrow: n, background: `var(--pitch-${p})` }}
              />
            ))
          )}
        </span>
        <div className={styles.foot}>
          {props.canChangeVisibility ? (
            <select
              className={styles.visibility}
              aria-label={`Who can see ${deck.name}`}
              value={deck.visibility}
              data-shared={deck.visibility === "private" ? undefined : ""}
              onChange={(e) => props.onVisibility(e.target.value as Visibility)}
            >
              {VISIBILITIES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          ) : (
            <span
              className={styles.badge}
              data-public={deck.visibility === "public" ? "" : undefined}
            >
              {visibilityLabel(deck.visibility)}
            </span>
          )}
          {props.yours && !props.canChangeVisibility && (
            <span className={styles.badge} data-yours="">
              Yours
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function NewDeckDialog(props: {
  onClose: () => void;
  onCreate: (name: string, visibility: Visibility) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const whoId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name the deck first.");
    setBusy(true);
    try {
      await props.onCreate(name.trim(), visibility);
    } catch (err) {
      setError(
        `Couldn't create the deck: ${err instanceof Error ? err.message : String(err)}`,
      );
      setBusy(false);
    }
  }

  return (
    <Dialog title="New deck" open onClose={props.onClose}>
      <form className={styles.newDeck} onSubmit={(e) => void submit(e)}>
        <TextField
          label="Deck name"
          maxLength={80}
          value={name}
          placeholder="Runechant aggro"
          error={error}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <div className={styles.who}>
          <label htmlFor={whoId}>Who can see it</label>
          <select
            id={whoId}
            aria-describedby={`${whoId}-hint`}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
          >
            {VISIBILITIES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
          <small id={`${whoId}-hint`}>
            {VISIBILITIES.find((v) => v.value === visibility)!.hint} You can
            change this later.
          </small>
        </div>
        <div className={styles.dialogActions}>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            Create deck
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Your decks and everyone's public decks, with a New deck button always to hand. */
export function DecksPage() {
  const { decks } = useServices();
  const { items } = useCards();
  const user = useAppSelector((s) => s.auth.user);
  const search = route.useSearch();
  const navigate = useNavigate();
  const tab = !user || search.tab === "public" ? "public" : "mine";
  const [lists, setLists] = useState<{
    mine?: DeckSummary[];
    public?: DeckSummary[];
  }>({});
  const [rules, setRules] = useState<FormatRules | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const lookup: Lookup = useMemo(
    () =>
      new Map(
        items.flatMap((card) =>
          card.variants.map((variant) => [variant.id, { card, variant }]),
        ),
      ),
    [items],
  );

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
    let live = true;
    setError(null);
    const load =
      tab === "mine" && user
        ? decks.listMyDecks(user.id)
        : decks.listPublicDecks();
    load.then(
      (list) => live && setLists((l) => ({ ...l, [tab]: list })),
      (e) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, [decks, user, tab, attempt]);

  const list = lists[tab];

  async function setVisibility(deck: DeckSummary, visibility: Visibility) {
    const swap = (l?: DeckSummary[]) =>
      l?.map((d) => (d.id === deck.id ? { ...d, visibility } : d));
    setLists((l) => ({ ...l, mine: swap(l.mine) }));
    try {
      await decks.setVisibility(deck.id, visibility);
    } catch (e) {
      setLists((l) => ({
        ...l,
        mine: l.mine?.map((d) => (d.id === deck.id ? deck : d)),
      }));
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const setTab = (t: "mine" | "public") =>
    void navigate({
      to: ".",
      replace: true,
      search: t === "public" ? { tab: "public" } : {},
    });

  return (
    <div className={styles.page}>
      {creating && (
        <NewDeckDialog
          onClose={() => setCreating(false)}
          onCreate={async (name, visibility) => {
            const deck = await decks.createDeck(name, { visibility });
            await navigate({
              to: "/decks/$deckId",
              params: { deckId: deck.id },
            });
          }}
        />
      )}

      <header className={styles.head}>
        <div>
          <h1>Decks</h1>
          <p className={styles.lead}>
            Your Viserai decks, and the ones other players have shared.
          </p>
        </div>
        {user ? (
          <Button variant="primary" onClick={() => setCreating(true)}>
            New deck
          </Button>
        ) : (
          <Link to="/sign-in" className={linkButton("primary")}>
            Sign in to build decks
          </Link>
        )}
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Deck lists">
        {user && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mine"}
            onClick={() => setTab("mine")}
          >
            My decks
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={tab === "public"}
          onClick={() => setTab("public")}
        >
          Public decks
        </button>
      </div>

      <div role="tabpanel" className={styles.panel}>
        {error ? (
          <div role="alert" className={styles.empty}>
            <strong>Couldn't load decks.</strong>
            <span>{error}</span>
            <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
          </div>
        ) : !list ? (
          <p className={styles.loading}>Loading decks…</p>
        ) : list.length === 0 ? (
          tab === "mine" ? (
            <div className={styles.empty}>
              <strong>You haven't built a deck yet.</strong>
              <span>
                Start from scratch, or let Build a core pick cards around
                Viserai's engines.
              </span>
              <div className={styles.emptyActions}>
                <Button variant="primary" onClick={() => setCreating(true)}>
                  New deck
                </Button>
                <Link to="/core" className={linkButton("secondary")}>
                  Start from Build a core
                </Link>
              </div>
            </div>
          ) : (
            <div className={styles.empty}>
              <strong>No public decks yet.</strong>
              <span>Make one of your decks public to share it here.</span>
            </div>
          )
        ) : (
          <ul
            className={styles.grid}
            aria-label={tab === "mine" ? "My decks" : "Public decks"}
          >
            {list.map((deck) => (
              <DeckTile
                key={deck.id}
                deck={deck}
                lookup={lookup}
                yours={deck.ownerId === user?.id}
                canChangeVisibility={tab === "mine"}
                onVisibility={(visibility) =>
                  void setVisibility(deck, visibility)
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
