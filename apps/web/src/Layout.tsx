import { Link, Outlet } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ComponentProps } from "react";
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

/** Admin-only pages in a dropdown; closes on Escape, an outside click or choosing a page. */
function AdminMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className={styles.menu} ref={root}>
      <button
        type="button"
        ref={button}
        className={styles.signOut}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        Admin <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className={styles.menuList} onClick={() => setOpen(false)}>
          <Tab to="/admin/synergy">Synergy weights</Tab>
          <Tab to="/admin/analytics">User analytics</Tab>
        </div>
      )}
    </div>
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
            {canScore && <Tab to="/needs-review">Reviews</Tab>}
            <Tab to="/synergies">Synergies</Tab>
            <Tab to="/core">Build core</Tab>
            <Tab to="/decks">Decks</Tab>
          </nav>
          {/* Apart from the page tabs, so on a phone it stays in view beside the name. */}
          <nav aria-label="Account" className={styles.account}>
            {isAdmin && <AdminMenu />}
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
