import { Link, Outlet } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { useSelector } from "react-redux";
import {
  selectCanScore,
  selectIsSignedIn,
  selectRole,
} from "./auth/authSlice.ts";
import type { RootState } from "./store.ts";
import { useServices } from "./servicesContext.ts";
import styles from "./Layout.module.css";

/** A tab in the header; the current page's tab is marked for screen readers and styled. */
function Tab(props: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={styles.tab}
      activeProps={{ "aria-current": "page", className: styles.tabActive }}
    />
  );
}

export function Layout() {
  const signedIn = useSelector((s: RootState) => selectIsSignedIn(s));
  const canScore = useSelector((s: RootState) => selectCanScore(s));
  const isAdmin = useSelector((s: RootState) => selectRole(s) === "admin");
  const { auth } = useServices();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.bar}>
          <Link
            to="/"
            className={styles.brand}
            aria-label="Viserai Deck Builder, home"
            activeOptions={{ exact: true }}
          >
            <span className={styles.wordmark}>Viserai</span>
            <span className={styles.subtitle}>Deck Builder</span>
          </Link>
          <nav aria-label="Main" className={styles.nav}>
            <Tab to="/cards">Cards</Tab>
            <Tab to="/core">Core</Tab>
            {canScore && <Tab to="/needs-review">Needs review</Tab>}
            <Tab to="/synergies">Synergies</Tab>
            <Tab to="/decks">Decks</Tab>
            {isAdmin && <Tab to="/admin/synergy">Synergy weights</Tab>}
          </nav>
          {/* Apart from the page tabs, so on a phone it stays in view beside the name. */}
          <nav aria-label="Account" className={styles.account}>
            {signedIn && <Tab to="/account">Account</Tab>}
            {signedIn ? (
              <button
                type="button"
                className={styles.signOut}
                onClick={() => void auth.signOut()}
              >
                Sign out
              </button>
            ) : (
              <Tab to="/sign-in">Sign in</Tab>
            )}
          </nav>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
