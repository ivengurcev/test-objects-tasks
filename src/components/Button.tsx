import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "outline" | "danger" | "danger-text" };

export function Button({ className = "", type = "button", variant = "primary", ...props }: Props) {
  return <button className={`${styles.button} ${variant === "primary" ? "" : styles[variant]} ${className}`} type={type} {...props} />;
}
