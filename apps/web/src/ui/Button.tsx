import type { ButtonHTMLAttributes, Ref } from "react";
import styles from "./ui.module.css";

export function Button({
  variant = "secondary",
  type = "button",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
