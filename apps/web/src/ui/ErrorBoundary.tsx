// A crash in one part of a page says so instead of blanking the page (the maintainer, 20 Oct
// 2026: "Synergies sometimes crashes"). The error is shown so it can be reported.
import { Component, type ReactNode } from "react";
import { Button } from "./Button.tsx";
import styles from "./ui.module.css";

export class ErrorBoundary extends Component<
  { what: string; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`${this.props.what} crashed:`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className={styles.crashed}>
        <p>
          <strong>{`${this.props.what} hit a problem.`}</strong> If it happens
          again, send this along: <code>{this.state.error.message}</code>
        </p>
        <Button onClick={() => this.setState({ error: null })}>
          Try again
        </Button>
      </div>
    );
  }
}
