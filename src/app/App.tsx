import styles from "./App.module.css";
import { supabaseConfigured } from "../lib/supabase";

export function App() {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="app-title">
        <span className={styles.eyebrow}>Мини-CRM · строительство</span>
        <h1 id="app-title">Объекты и задачи</h1>
        <p className={styles.description}>Приложение находится в разработке.</p>
        <p className={styles.connection}>
          <span
            className={`${styles.indicator} ${supabaseConfigured ? styles.connected : styles.disconnected}`}
            aria-hidden="true"
          />
          {supabaseConfigured
            ? "Настройки Supabase указаны"
            : "Для подключения добавьте настройки Supabase в .env.local"}
        </p>
      </section>
    </main>
  );
}
