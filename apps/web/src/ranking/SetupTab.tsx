import { pitchName } from "../cards/pitch.ts";
import type { PitchTargets } from "../decks/deckRepository.ts";
import type {
  CommunityAnswer,
  StrategyQuestion,
} from "../strategy/strategyRepository.ts";
import { Button, Slider } from "../ui/index.ts";
import { PREFERENCES } from "./preferences.ts";
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

export function Presets(props: {
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

/** One strategy question: your 1–10 answer, and the scoring group's average beside it. */
function Question(props: {
  question: StrategyQuestion;
  mine?: number;
  community?: CommunityAnswer;
  signedIn: boolean;
  onAnswer: (answer: number) => void;
}) {
  const { question: q, community } = props;
  return (
    <div className={styles.question} role="group" aria-label={q.prompt}>
      <span className={styles.questionPrompt}>{q.prompt}</span>
      <div className={styles.scale}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={props.mine === n}
            disabled={!props.signedIn}
            onClick={() => props.onAnswer(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <span className={styles.ends} aria-hidden="true">
        <span>{q.lowLabel}</span>
        <span>{q.highLabel}</span>
      </span>
      {community && community.answers > 0 ? (
        <span className={styles.community}>
          <span>{`Scoring group ${community.average.toFixed(1)} · ${community.answers} ${community.answers === 1 ? "answer" : "answers"}`}</span>
          <span className={styles.communityTrack} aria-hidden="true">
            <b style={{ left: `${((community.average - 1) / 9) * 100}%` }} />
          </span>
        </span>
      ) : (
        <span className={styles.community}>
          No answers from the scoring group yet
        </span>
      )}
    </div>
  );
}

/** Set up: how you want to play, your preferences, pitch targets and strategy, as one form. */
export function SetupTab(props: {
  settings: RankingSettings;
  onSettings: (patch: Partial<RankingSettings>) => void;
  showBlend: boolean;
  targets: PitchTargets;
  onTargets: (targets: PitchTargets) => void;
  pitchCounts: Record<number, number>;
  /** Fill the core to the pitch targets and show the board. */
  onBuild: () => void;
  questions: StrategyQuestion[];
  myAnswers: Record<string, number>;
  community: Record<string, CommunityAnswer>;
  signedIn: boolean;
  onAnswer: (key: string, answer: number) => void;
  /** Show the board without adding cards. */
  onSkip: () => void;
}) {
  const { settings } = props;
  return (
    <form className={styles.setup} onSubmit={(e) => e.preventDefault()}>
      <section className={styles.formCard} aria-labelledby="setup-play">
        <header>
          <h2 id="setup-play">How you want to play</h2>
          <p>These rank the board. Nothing here changes a card's score.</p>
        </header>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Play style</span>
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
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Side</span>
          <Presets
            label="Side"
            options={SIDE_PRESETS}
            value={settings.sideFocus}
            onChange={(sideFocus) => props.onSettings({ sideFocus })}
          />
          <span className={styles.hint}>
            Puts that side's engine first on the board.
          </span>
        </div>
        {props.showBlend && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Whose scores</span>
            <Presets
              label="Whose scores"
              options={SOURCE_PRESETS}
              value={settings.sourceBlend}
              onChange={(sourceBlend) => props.onSettings({ sourceBlend })}
            />
          </div>
        )}
        <div className={styles.field}>
          <Slider
            label="Synergy strength"
            noScale
            value={settings.synergy}
            onChange={(synergy) => props.onSettings({ synergy })}
          />
          <span className={styles.ends} aria-hidden="true">
            <span>Off</span>
            <span>Strong</span>
          </span>
          <span className={styles.hint}>
            Building the core picks cards that work with the ones already in it.
            Off until the scoring group agrees a setting.
          </span>
        </div>
      </section>

      <section className={styles.formCard} aria-labelledby="setup-prefs">
        <header>
          <h2 id="setup-prefs">Preferences</h2>
          <p>
            Lean towards a style of card. Companions come along at half
            strength.
          </p>
        </header>
        {PREFERENCES.map((p) => (
          <div key={p.id} className={styles.field}>
            <Slider
              label={p.label}
              noScale
              value={settings.prefs[p.id] ?? 50}
              onChange={(n) => {
                const prefs = { ...settings.prefs, [p.id]: n };
                if (n === 50) delete prefs[p.id];
                props.onSettings({ prefs });
              }}
            />
            <span className={styles.ends} aria-hidden="true">
              <span>Avoid</span>
              <span>Prefer</span>
            </span>
            <span className={styles.hint}>{p.note}</span>
          </div>
        ))}
      </section>

      <section className={styles.formCard} aria-labelledby="setup-targets">
        <header>
          <h2 id="setup-targets">Pitch targets</h2>
          <p>
            Copies of each pitch the core aims for. Build the core fills each
            pitch from the board, best first, keeping any cards you've added.
          </p>
        </header>
        {PITCHES.map((pitch) => {
          const n = props.pitchCounts[pitch] ?? 0;
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
      </section>

      <section className={styles.formCard} aria-labelledby="setup-strategy">
        <header>
          <h2 id="setup-strategy">Strategy</h2>
          <p>
            Asked once, not per card. Your answer is yours; the scoring group's
            average shows beside it.
          </p>
        </header>
        {!props.signedIn && <p className={styles.hint}>Sign in to answer.</p>}
        {props.questions.map((q) => (
          <Question
            key={q.key}
            question={q}
            mine={props.myAnswers[q.key]}
            community={props.community[q.key]}
            signedIn={props.signedIn}
            onAnswer={(n) => props.onAnswer(q.key, n)}
          />
        ))}
      </section>

      <div className={styles.setupNext}>
        <Button variant="ghost" onClick={props.onSkip}>
          Go to the board without adding cards
        </Button>
        <Button variant="primary" onClick={props.onBuild}>
          Build the core →
        </Button>
      </div>
    </form>
  );
}
