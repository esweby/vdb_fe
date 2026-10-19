import {
  deriveSynergies,
  SYNERGY_RULES,
  type SynergyEdge,
  type SynergyRule,
} from "@vdb/cards";
import { useEffect, useMemo, useState } from "react";
import { useCards } from "../cards/useCards.ts";
import { useServices } from "../servicesContext.ts";
import { Button, LoadError, Loading, Table, TextField } from "../ui/index.ts";
import styles from "./SynergyWeightsPage.module.css";

/**
 * Synergy rule weights, for admins (maintainer, 19 Oct 2026; docs/synergy-rules.md "Weights").
 * Rules are code; their weights are data. A weight here replaces the rule's default, and 0
 * turns the rule off.
 */
export function SynergyWeightsPage() {
  const { synergy } = useServices();
  const cards = useCards();
  const [weights, setWeights] = useState<Record<string, number> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    synergy.listRuleWeights().then(
      (w) => live && setWeights(w),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [synergy, attempt]);

  // What each rule links in the current pool, at its default weight.
  const byRule = useMemo(() => {
    if (cards.status !== "loaded") return null;
    const edges = deriveSynergies(
      cards.items.map((c) => ({
        ...c,
        variantAttributes: c.variants.map((v) => v.attributes),
      })),
    );
    const names = new Map(cards.items.map((c) => [c.id, c.name]));
    const grouped = new Map<string, SynergyEdge[]>();
    for (const e of edges)
      for (const id of e.reasons)
        grouped.set(id, [...(grouped.get(id) ?? []), e]);
    return { grouped, names };
  }, [cards.status, cards.items]);

  if (failed)
    return (
      <LoadError
        what="the synergy weights"
        onRetry={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
      />
    );
  if (!weights) return <Loading label="Loading synergy weights" />;

  async function save(ruleId: string, weight: number) {
    await synergy.setRuleWeight(ruleId, weight);
    setWeights((w) => ({ ...w, [ruleId]: weight }));
  }
  async function reset(ruleId: string) {
    await synergy.resetRuleWeight(ruleId);
    setWeights((w) => {
      const next = { ...w };
      delete next[ruleId];
      return next;
    });
  }

  return (
    <section className={styles.page}>
      <h1>Synergy weights</h1>
      <p className={styles.intro}>
        How much each rule's links count, from 0 to 1. A weight here replaces
        the rule's default for everyone; 0 turns the rule off. Default weights
        are unverified starting points.
      </p>
      <Table<SynergyRule>
        caption="Synergy rules"
        rows={SYNERGY_RULES}
        rowKey={(r) => r.id}
        columns={[
          {
            key: "rule",
            header: "Rule",
            render: (r) => (
              <>
                <span className={styles.description}>{r.description}</span>
                <code className={styles.id}>{r.id}</code>
              </>
            ),
          },
          {
            key: "engine",
            header: "Engine",
            render: (r) => r.engine ?? "Reference",
          },
          {
            key: "links",
            header: "In the pool",
            render: (r) => {
              if (!byRule) return "…";
              const edges = byRule.grouped.get(r.id) ?? [];
              const first = edges[0];
              return (
                <>
                  {`${edges.length} link${edges.length === 1 ? "" : "s"}`}
                  {first && (
                    <span className={styles.example}>
                      e.g. {byRule.names.get(first.from)} →{" "}
                      {byRule.names.get(first.to)}
                    </span>
                  )}
                </>
              );
            },
          },
          {
            key: "weight",
            header: "Weight",
            render: (r) => (
              <WeightField
                rule={r}
                override={weights[r.id]}
                onSave={(w) => save(r.id, w)}
                onReset={() => reset(r.id)}
              />
            ),
          },
        ]}
      />
    </section>
  );
}

function WeightField(props: {
  rule: SynergyRule;
  override: number | undefined;
  onSave: (weight: number) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const current = props.override ?? props.rule.weight;
  const [text, setText] = useState(String(current));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(String(current)), [current]);

  async function commit() {
    const value = Number(text);
    if (
      text.trim() === "" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1
    ) {
      setError("From 0 to 1");
      return;
    }
    setError(null);
    const weight = Math.round(value * 100) / 100;
    if (weight === current) return;
    try {
      await props.onSave(weight);
    } catch (e) {
      setError(`Couldn't save: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className={styles.weight}>
      <TextField
        label={`Weight for ${props.rule.id}`}
        hideLabel
        type="number"
        min={0}
        max={1}
        step={0.05}
        value={text}
        error={error}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => e.key === "Enter" && void commit()}
      />
      <span className={styles.default}>
        {current === 0 && <strong>Off</strong>}
        {props.override !== undefined && `Default ${props.rule.weight}`}
      </span>
      {props.override !== undefined && (
        <Button onClick={() => void props.onReset()}>Use default</Button>
      )}
    </div>
  );
}
