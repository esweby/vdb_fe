import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from "react";
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

const SITE = "Viserai Deck Builder";

/**
 * Names the browser tab after the page's heading and, after the first page, moves focus to that
 * heading on each new page, so screen readers say where you've landed (M8 keyboard pass). A
 * change to the query alone (filters, an open card) isn't a new page. Pages that load their
 * heading later are caught when it appears.
 */
function usePageHeading(main: RefObject<HTMLElement | null>) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // The address focus last moved for; none yet on the first page (and StrictMode's rerun of it).
  const shownPath = useRef<string | null>(null);
  const lastHeading = useRef<{ el: Element; text: string } | null>(null);
  useEffect(() => {
    const root = main.current;
    if (!root) return;
    let moveFocus =
      shownPath.current !== null && shownPath.current !== pathname;
    shownPath.current = pathname;
    // The page before can still be showing for a moment: wait for this page's heading.
    const before = lastHeading.current;
    const update = () => {
      const heading = root.querySelector("h1");
      const name = heading?.textContent?.trim() ?? "";
      if (heading && before?.el === heading && before.text === name) return;
      if (heading) lastHeading.current = { el: heading, text: name };
      document.title = name && name !== SITE ? `${name} · ${SITE}` : SITE;
      if (!heading || !moveFocus) return;
      moveFocus = false;
      // Leave focus alone if the page has already put it somewhere, e.g. in a dialog.
      const active = document.activeElement;
      if (active && active !== document.body && root.contains(active)) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    };
    update();
    const watch = new MutationObserver(update);
    watch.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => watch.disconnect();
  }, [main, pathname]);
}

export function Layout() {
  const main = useRef<HTMLElement>(null);
  usePageHeading(main);
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
      <main className={styles.main} ref={main}>
        <Outlet />
      </main>
    </div>
  );
}
