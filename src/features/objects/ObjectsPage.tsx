import { useCallback, useEffect, useState, type SubmitEvent } from "react";
import type { Profile } from "./types";
import styles from "./ObjectsPage.module.css";
import { createObject, deleteObject, listActiveTaskStatuses, listObjects, updateObject, type CrmObject } from "./objectsApi";
import { TasksPanel, type TaskPanelView } from "../tasks/TasksPanel";

type Props = {
  profile: Profile;
  onSignOut: () => void;
  signOutError: string;
};

type View =
  | { kind: "list" }
  | { kind: "object"; object: CrmObject }
  | { kind: "object-form"; mode: "create" }
  | { kind: "object-form"; mode: "edit"; object: CrmObject };

type TaskCounts = Record<string, { review: number; completed: number; open: number }>;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? `${fallback} ${error.message}` : fallback;
}

export function ObjectsPage({ profile, onSignOut, signOutError }: Props) {
  const isManager = profile.role === "manager";
  const [objects, setObjects] = useState<CrmObject[]>([]);
  const [view, setView] = useState<View>({ kind: "list" });
  const [taskView, setTaskView] = useState<TaskPanelView>({ kind: "list" });
  const [createTaskAction, setCreateTaskAction] = useState<(() => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [taskCounts, setTaskCounts] = useState<TaskCounts>({});
  const [countsLoading, setCountsLoading] = useState(true);
  const [countsError, setCountsError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [nameError, setNameError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const refreshObjects = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setObjects(await listObjects());
    } catch (error) {
      setLoadError(errorMessage(error, "Не удалось загрузить объекты. Проверьте подключение и права доступа."));
    } finally {
      setLoading(false);
    }
  };

  const refreshTaskCounts = async () => {
    setCountsLoading(true);
    setCountsError("");
    try {
      const rows = await listActiveTaskStatuses();
      const next: TaskCounts = {};
      for (const row of rows) {
        const counts = next[row.object_id] ??= { review: 0, completed: 0, open: 0 };
        if (row.status === "accepted") counts.completed += 1;
        else if (["new", "in_progress", "in_review", "rework"].includes(row.status)) {
          counts.open += 1;
          if (row.status === "in_review") counts.review += 1;
        }
      }
      setTaskCounts(next);
    } catch (error) {
      setTaskCounts({});
      setCountsError(errorMessage(error, "Не удалось загрузить счётчики задач."));
    } finally {
      setCountsLoading(false);
    }
  };

  const registerCreateTaskAction = useCallback((action: (() => void) | null) => {
    setCreateTaskAction(() => action);
  }, []);

  useEffect(() => {
    void refreshObjects();
    void refreshTaskCounts();
  }, []);

  const openObject = (object: CrmObject) => {
    setTaskView({ kind: "list" });
    setView({ kind: "object", object });
    setFormError("");
  };

  const startCreate = () => {
    setName("");
    setAddress("");
    setFormError("");
    setNameError("");
    setAddressError("");
    setView({ kind: "object-form", mode: "create" });
  };

  const startEdit = (object: CrmObject) => {
    setTaskView({ kind: "list" });
    setName(object.name);
    setAddress(object.address);
    setFormError("");
    setNameError("");
    setAddressError("");
    setView({ kind: "object-form", mode: "edit", object });
  };

  const cancelObjectForm = () => {
    setFormError("");
    setNameError("");
    setAddressError("");
    setTaskView({ kind: "list" });
    setView((current) => current.kind === "object-form" && current.mode === "edit"
      ? { kind: "object", object: current.object }
      : { kind: "list" });
  };

  const handleSaveObject = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const cleanName = name.trim();
    const cleanAddress = address.trim();
    const nextNameError = cleanName ? "" : "Укажите название объекта.";
    const nextAddressError = cleanAddress ? "" : "Укажите адрес объекта.";
    setNameError(nextNameError);
    setAddressError(nextAddressError);
    if (nextNameError || nextAddressError) return;

    setSaving(true);
    setFormError("");
    try {
      const current = view;
      if (current.kind !== "object-form") return;
      const object = current.mode === "edit"
        ? await updateObject(current.object.id, cleanName, cleanAddress)
        : await createObject(cleanName, cleanAddress);
      setObjects((items) => [...items.filter((item) => item.id !== object.id), object]
        .sort((left, right) => left.name.localeCompare(right.name)));
      setView({ kind: "object", object });
      if (!countsError) setTaskCounts((counts) => ({ ...counts, [object.id]: counts[object.id] ?? { review: 0, completed: 0, open: 0 } }));
    } catch (error) {
      setFormError(errorMessage(error, "Не удалось сохранить объект. Проверьте права доступа и попробуйте ещё раз."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteObject = async (object: CrmObject) => {
    if (!window.confirm(`Удалить объект «${object.name}»?`) || saving) return;
    setSaving(true);
    setFormError("");
    try {
      await deleteObject(object.id);
      setObjects((items) => items.filter((item) => item.id !== object.id));
      setTaskCounts((items) => {
        const next = { ...items };
        delete next[object.id];
        return next;
      });
      setView({ kind: "list" });
    } catch (error) {
      setFormError(errorMessage(error, "Не удалось удалить объект. Проверьте права доступа и попробуйте ещё раз."));
    } finally {
      setSaving(false);
    }
  };

  const isFormScreen = view.kind === "object-form" || (view.kind === "object" && taskView.kind === "form");
  const showObjectError = view.kind === "object" && taskView.kind === "list";
  const formTitle = view.kind === "object-form"
    ? view.mode === "create" ? "Создание объекта" : "Редактирование объекта"
    : view.kind === "object" && taskView.kind === "form" ? taskView.title : "";

  return (
    <section className={styles.container} aria-label="Мини-CRM">
      <div className={`${styles.utilityBar} ${isFormScreen ? styles.utilityBarForm : ""}`}>
        <span>Мини-CRM · строительство</span>
        <span>{profile.display_name} · {isManager ? "Постановщик" : "Исполнитель"}</span>
      </div>
      {!isFormScreen && <nav className={styles.navigation} aria-label="Навигация приложения">
        <div>
          {view.kind === "object" && taskView.kind === "list" && <button className={styles.backButton} type="button" onClick={() => { setView({ kind: "list" }); setTaskView({ kind: "list" }); setFormError(""); void refreshObjects(); void refreshTaskCounts(); }}>← Назад к списку объектов</button>}
          {view.kind === "object" && taskView.kind === "card" && <button className={styles.backButton} type="button" onClick={taskView.onBack}>← Назад к объекту</button>}
        </div>
        <button className={styles.secondaryButton} type="button" onClick={onSignOut}>Выйти</button>
      </nav>}
      {!isFormScreen && signOutError && <p className={styles.error} role="alert">{signOutError}</p>}
      {isFormScreen && <header className={styles.sectionHeader}><h1>{formTitle}</h1></header>}
      {showObjectError && formError && <p className={styles.error} role="alert">{formError}</p>}

      {view.kind === "list" ? <>
        <header className={styles.sectionHeader}><h1>Объекты</h1></header>
        <div className={styles.listHeading}>
          <p className={styles.muted}>Активные объекты</p>
          {isManager && <button className={styles.primaryButton} type="button" onClick={startCreate}>Создать объект</button>}
        </div>
        {loading ? <p role="status">Загружаем объекты…</p>
          : loadError ? <div className={styles.empty}><p role="alert">{loadError}</p><button className={styles.secondaryButton} type="button" onClick={() => void refreshObjects()}>Повторить</button></div>
            : objects.length === 0 ? <p className={styles.empty}>Пока нет доступных объектов.</p>
              : <ul className={styles.objectList}>{objects.map((object) => <li key={object.id}>
                <button className={styles.objectLink} type="button" onClick={() => openObject(object)}>
                  <strong>{object.name}</strong><span className={styles.objectAddress}>{object.address}</span>
                  <span className={countsLoading ? styles.countState : countsError ? styles.countError : styles.counts}>
                    {countsLoading ? "Обновляем счётчики…" : countsError ? "Счётчики недоступны" : <>
                      <span className={styles.reviewCount}>На проверке: {taskCounts[object.id]?.review ?? 0}</span>
                      <span>Выполнено: {taskCounts[object.id]?.completed ?? 0}</span>
                      <span>Незакрыто: {taskCounts[object.id]?.open ?? 0}</span>
                    </>}
                  </span>
                </button>
              </li>)}</ul>}
      </> : view.kind === "object-form" ? <form className={styles.form} noValidate onSubmit={handleSaveObject}>
        <label className={styles.field}>Название
          <input value={name} onChange={(event) => { setName(event.target.value); setNameError(""); }} required aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "object-name-error" : undefined} disabled={saving} />
          {nameError && <span id="object-name-error" className={styles.fieldError} role="alert">{nameError}</span>}
        </label>
        <label className={styles.field}>Адрес
          <input value={address} onChange={(event) => { setAddress(event.target.value); setAddressError(""); }} required aria-invalid={Boolean(addressError)} aria-describedby={addressError ? "object-address-error" : undefined} disabled={saving} />
          {addressError && <span id="object-address-error" className={styles.fieldError} role="alert">{addressError}</span>}
        </label>
        {formError && <p className={styles.error} role="alert">{formError}</p>}
        <div className={styles.actions}>
          <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</button>
          <button className={styles.secondaryButton} type="button" onClick={cancelObjectForm} disabled={saving}>Отмена</button>
        </div>
      </form> : <>
        {taskView.kind === "list" && <>
          <header className={styles.sectionHeader}><h1>Объект: {view.object.name}</h1></header>
          {isManager && <div className={styles.actions}>
            {createTaskAction && <button className={styles.primaryButton} type="button" onClick={createTaskAction}>Создать задачу</button>}
            <button className={styles.primaryButton} type="button" onClick={() => startEdit(view.object)}>Редактировать</button>
            <button className={styles.dangerButton} type="button" disabled={saving} onClick={() => void handleDeleteObject(view.object)}>Удалить</button>
          </div>}
          <div className={styles.detail}>
            <div><span className={styles.label}>Название</span><p>{view.object.name}</p></div>
            <div><span className={styles.label}>Адрес</span><p>{view.object.address}</p></div>
          </div>
        </>}
        {view.kind === "object" && <div className={styles.tasks}>
          <TasksPanel
            key={view.object.id}
            objectId={view.object.id}
            isManager={isManager}
            onViewChange={setTaskView}
            onDataChange={() => void refreshTaskCounts()}
            onCreateActionChange={registerCreateTaskAction}
          />
        </div>}
      </>}
    </section>
  );
}
