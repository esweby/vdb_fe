// A scenario shared by link (README "Saved scenarios": anyone with the link can view and copy
// it). Curators can add it to the library from here.
import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { selectRole } from "../auth/authSlice.ts";
import { useAppSelector } from "../hooks.ts";
import { useServices } from "../servicesContext.ts";
import { Button, Loading } from "../ui/index.ts";
import { labelsOf, stepLabel } from "./blocks.ts";
import type { SavedScenario } from "./scenarioRepository.ts";
import styles from "./ScenarioBuilder.module.css";

const route = getRouteApi("/scenarios/$scenarioId");

const ACCESS: Record<string, string> = {
  hand: "the hand",
  arsenal: "the arsenal",
  topOfDeck: "the top card of the deck",
};

export function SharedScenarioPage() {
  const { scenarioId } = route.useParams();
  const { scenarios } = useServices();
  const user = useAppSelector((s) => s.auth.user);
  const role = useAppSelector(selectRole);
  const [scenario, setScenario] = useState<SavedScenario | null | undefined>();
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    scenarios.getShared(scenarioId).then(
      (s) => live && setScenario(s),
      () => live && setScenario(null),
    );
    return () => {
      live = false;
    };
  }, [scenarios, scenarioId]);

  if (scenario === undefined) return <Loading label="Loading the scenario" />;
  if (scenario === null)
    return (
      <section className={styles.builder}>
        <p>This scenario isn't shared, or doesn't exist.</p>
      </section>
    );

  const d = scenario.definition;
  const curator = role === "curator" || role === "admin";

  async function copy() {
    if (!user) return;
    try {
      await scenarios.saveScenario(user.id, {
        definition: d,
        visibility: "private",
      });
      setNote(
        "Copied to your scenarios. Open one of your decks' Scenarios tab to run it.",
      );
    } catch {
      setNote("Couldn't copy the scenario.");
    }
  }

  async function library(inLibrary: boolean) {
    try {
      await scenarios.setLibrary(scenario!.id, inLibrary);
      setScenario({
        ...scenario!,
        visibility: inLibrary ? "library" : "link",
      });
    } catch {
      setNote("Couldn't change the library.");
    }
  }

  return (
    <section className={styles.builder} aria-label="Shared scenario">
      <header>
        <h1>{d.name}</h1>
        <p className={styles.hint}>
          {d.horizon === 0
            ? "Checks the opening hand"
            : `Checks by turn ${d.horizon}`}
          {`, looking at ${d.access.map((a) => ACCESS[a] ?? a).join(", ")} plus weapons and equipment.`}
          {d.fixed?.length
            ? ` Assumes ${d.fixed.map((f) => `${f.name} in ${f.zone}`).join(", ")}.`
            : ""}
        </p>
      </header>
      {d.steps?.length ? (
        <>
          <h2 id="steps">Steps</h2>
          <ul aria-labelledby="steps">
            {d.steps.map((step, n) => (
              <li key={n}>{stepLabel(step)}</li>
            ))}
          </ul>
        </>
      ) : null}
      <h2 id="checks">
        What it checks ({"all" in d.condition ? "all" : "any"} of)
      </h2>
      <ul aria-labelledby="checks">
        {labelsOf(d.condition).map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
      <div className={styles.save}>
        {user ? (
          <Button variant="primary" onClick={copy}>
            Copy to my scenarios
          </Button>
        ) : (
          <Link to="/sign-in">Sign in to copy it</Link>
        )}
        {curator &&
          (scenario.visibility === "library" ? (
            <Button onClick={() => library(false)}>
              Take out of the library
            </Button>
          ) : (
            <Button onClick={() => library(true)}>Add to the library</Button>
          ))}
      </div>
      {note && <p role="status">{note}</p>}
    </section>
  );
}
