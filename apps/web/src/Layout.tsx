import { Link, Outlet } from "@tanstack/react-router";
import { useSelector } from "react-redux";
import { selectCanScore, selectIsSignedIn } from "./auth/authSlice.ts";
import type { RootState } from "./store.ts";
import { useServices } from "./services.tsx";
import styles from "./Layout.module.css";
import { Button } from "./ui/index.ts";

export function Layout() {
  const signedIn = useSelector((s: RootState) => selectIsSignedIn(s));
  const canScore = useSelector((s: RootState) => selectCanScore(s));
  const { auth } = useServices();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          Viserai Deck Builder
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          <Link to="/cards">Cards</Link>
          <Link to="/ranking">Ranking</Link>
          {canScore && <Link to="/needs-review">Needs review</Link>}
          {signedIn && <Link to="/decks">Decks</Link>}
          {signedIn && <Link to="/account">Account</Link>}
          {signedIn ? (
            <Button variant="ghost" onClick={() => void auth.signOut()}>
              Sign out
            </Button>
          ) : (
            <Link to="/sign-in">Sign in</Link>
          )}
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
