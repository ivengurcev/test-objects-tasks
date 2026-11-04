import { useEffect, useRef, useState } from "react";
import type { Profile } from "../features/objects/types";
import styles from "./App.module.css";

type Props = {
  profile: Profile;
  onSignOut: () => void;
};

export function AppHeader({ profile, onSignOut }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const roleName = profile.role === "manager" ? "Постановщик" : "Исполнитель";
  const initials = profile.display_name.trim().split(/\s+/).slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "").join("").toLocaleUpperCase("ru-RU") || "?";

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        avatarRef.current?.focus({ preventScroll: true });
      }
    };
    const mobile = window.matchMedia("(max-width: 640px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => { if (!event.matches) setMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    mobile.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      mobile.removeEventListener("change", closeOnDesktop);
    };
  }, [menuOpen]);

  return <header className={styles.appHeader}>
    <div className={styles.headerInner}>
      <div className={styles.brand}><strong>Мини-CRM</strong><span>Строительство · Объекты и задачи</span></div>
      <div className={styles.account}><span>{profile.display_name} · {roleName}</span>
        <button className={styles.secondaryButton} type="button" onClick={onSignOut}>Выйти</button>
      </div>
      <div className={styles.mobileAccount} ref={accountRef}>
        <button className={styles.avatarButton} type="button" ref={avatarRef}
          aria-label="Меню пользователя" aria-expanded={menuOpen} aria-controls="user-menu"
          onClick={() => setMenuOpen((open) => !open)}>{initials}</button>
        {menuOpen && <section className={styles.userMenu} id="user-menu" aria-label="Профиль пользователя">
          <strong className={styles.userName}>{profile.display_name}</strong>
          <span className={styles.userRole}>{roleName}</span>
          <button className={styles.secondaryButton} type="button" onClick={onSignOut}>Выйти</button>
        </section>}
      </div>
    </div>
  </header>;
}
