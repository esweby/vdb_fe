import type { ReactNode } from "react";
import styles from "./ui.module.css";

export function Tag(props: {
  children: ReactNode;
  tone?: "neutral" | "accent";
}) {
  return (
    <span
      className={[styles.tag, props.tone === "accent" && styles.tagAccent]
        .filter(Boolean)
        .join(" ")}
    >
      {props.children}
    </span>
  );
}
