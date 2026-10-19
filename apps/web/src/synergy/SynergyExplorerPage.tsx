import {
  getRouteApi,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import {
  readExplorerSearch,
  writeExplorerSearch,
  type ExplorerSettings,
} from "./explorer.ts";
import { SynergyExplorer } from "./SynergyExplorer.tsx";
import styles from "./SynergyExplorerPage.module.css";

const route = getRouteApi("/synergies");

/**
 * The Synergies page: the explorer on the whole pool, with its settings in the URL so a view
 * can be shared. The core and deck views are Synergies tabs in Build a core and the deck page.
 */
export function SynergyExplorerPage() {
  const search = route.useSearch() as Record<string, unknown>;
  const navigate = useNavigate();
  const router = useRouter();
  // No core here (maintainer, 19 Oct 2026), so a core start falls back to everything.
  const read = readExplorerSearch(search);
  const settings: ExplorerSettings =
    read.start === "core" ? { ...read, start: "all" } : read;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Synergies</h1>
      {/* Maintainer, 19 Oct 2026: say plainly what the links are, and aren't. */}
      <p className={styles.intro}>
        These links come from rules that read each card&apos;s text, so they
        show cards that can work together, not how well. Most haven&apos;t been
        checked by players yet: treat them as ideas to test, not advice. Scorers
        can confirm or correct them in{" "}
        <Link to="/needs-review/synergies">Confirm synergies</Link>.
      </p>
      <SynergyExplorer
        settings={settings}
        onChange={(patch, push = false) =>
          void navigate({
            to: ".",
            replace: !push,
            search: writeExplorerSearch({ ...settings, ...patch }) as never,
          })
        }
        onBack={() => router.history.back()}
      />
    </div>
  );
}
