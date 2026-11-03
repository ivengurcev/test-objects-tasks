import { useEffect, useState, type SubmitEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import styles from "./App.module.css";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { ObjectsPage } from "../features/objects/ObjectsPage";
import { MyTasksPage } from "../features/tasks/MyTasksPage";
import type { Profile } from "../features/objects/types";

type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "profile-error"; message: string }
  | { status: "signed-in"; profile: Profile };

async function loadProfile(userId: string): Promise<Profile> {
  if (!supabase) throw new Error("Supabase не настроен.");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error("Не удалось загрузить профиль. Попробуйте обновить страницу.");
  if (!data) {
    throw new Error("Для этой учётной записи не найден профиль. Обратитесь к администратору.");
  }
  if ((data.role !== "manager" && data.role !== "executor") || !data.display_name) {
    throw new Error("Профиль пользователя заполнен некорректно. Обратитесь к администратору.");
  }

  return data;
}

export function App() {
  const [authState, setAuthState] = useState<AuthState>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setAuthState({ status: "signed-out" });
      return;
    }

    let active = true;
    let currentUserId: string | null | undefined;

    const applySession = async (session: Session | null) => {
      const userId = session?.user.id ?? null;
      if (userId === currentUserId) return;
      currentUserId = userId;
      if (!userId) {
        if (active) setAuthState({ status: "signed-out" });
        return;
      }

      if (active) setAuthState({ status: "loading" });
      try {
        const profile = await loadProfile(userId);
        if (active && currentUserId === userId) setAuthState({ status: "signed-in", profile });
      } catch (error) {
        if (active && currentUserId === userId) {
          setAuthState({
            status: "profile-error",
            message: error instanceof Error ? error.message : "Не удалось загрузить профиль.",
          });
        }
      }
    };

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        if (active && currentUserId === undefined) setAuthState({ status: "signed-out" });
        return;
      }
      if (active && currentUserId === undefined) void applySession(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer SDK queries until the auth callback has completed.
      window.setTimeout(() => {
        if (active) void applySession(session);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setFormError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setFormError("Не удалось войти. Проверьте email и пароль.");
    } catch {
      setFormError("Не удалось связаться с Supabase. Проверьте подключение и попробуйте снова.");
    } finally {
      setPassword("");
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    setSignOutError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setSignOutError("Не удалось завершить сеанс. Попробуйте ещё раз.");
    } catch {
      setSignOutError("Не удалось связаться с Supabase. Сеанс не завершён.");
    }
  };

  return (
    <main className={styles.page}>
      {authState.status === "signed-in" ? (
        authState.profile.role === "manager"
          ? <ObjectsPage profile={authState.profile} onSignOut={handleSignOut} signOutError={signOutError} />
          : <MyTasksPage profile={authState.profile} onSignOut={handleSignOut} signOutError={signOutError} />
      ) : <section className={styles.card} aria-labelledby="app-title">
        <span className={styles.eyebrow}>Мини-CRM · строительство</span>
        <h1 id="app-title">Объекты и задачи</h1>
        {!supabaseConfigured ? (
          <p className={styles.description} role="status">
            Для входа настройте SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY в .env.local.
          </p>
        ) : authState.status === "loading" ? (
          <p className={styles.description} role="status">Проверяем сессию и загружаем профиль…</p>
        ) : authState.status === "profile-error" ? (
          <div className={styles.notice} role="alert">
            <p>{authState.message}</p>
            <p>Доступ к приложению не предоставлен.</p>
            {signOutError && <p>{signOutError}</p>}
            <button className={styles.secondaryButton} type="button" onClick={handleSignOut}>Выйти</button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSignIn}>
            <p className={styles.description}>Войдите, чтобы продолжить.</p>
            <label className={styles.field}>
              Email
              <input autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className={styles.field}>
              Пароль
              <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            {formError && <p className={styles.error} role="alert">{formError}</p>}
            <button className={styles.primaryButton} type="submit" disabled={submitting}>
              {submitting ? "Входим…" : "Войти"}
            </button>
          </form>
        )}
      </section>}
    </main>
  );
}
