import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import styles from "./FormControls.module.css";

export function TextInput({ className = "", type = "text", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type={type} className={`${styles.control} ${className}`} {...props} />;
}

export function TextArea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${styles.control} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${styles.control} ${className}`} {...props} />;
}
