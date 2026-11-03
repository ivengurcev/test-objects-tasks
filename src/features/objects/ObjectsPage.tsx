import { useEffect, useState, type SubmitEvent } from "react";
import type { Profile } from "./types";
import styles from "./ObjectsPage.module.css";
import { createObject, deleteObject, listObjects, updateObject, type CrmObject } from "./objectsApi";
import { TasksPanel } from "../tasks/TasksPanel";

type Props = {
  profile: Profile;
  onSignOut: () => void;
  signOutError: string;
};

type View = "list" | { object: CrmObject };

export function ObjectsPage({ profile, onSignOut, signOutError }: Props) {
  const isManager = profile.role === "manager";
  const [objects, setObjects] = useState<CrmObject[]>([]);
  const [view, setView] = useState<View>("list");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const refreshObjects = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await listObjects();
      setObjects(result);
      setView((current) => current !== "list"
        ? { object: result.find((object) => object.id === current.object.id) ?? current.object }
        : current);
    } catch {
      setLoadError("Не удалось загрузить объекты. Проверьте подключение и права доступа.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshObjects();
  }, []);

  const openObject = (object: CrmObject) => {
    setView({ object });
    setName(object.name);
    setAddress(object.address);
    setEditing(false);
    setFormError("");
  };

  const startCreate = () => {
    setView("list");
    setName("");
    setAddress("");
    setEditing(true);
    setFormError("");
  };

  const handleSave = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanAddress = address.trim();
    if (!cleanName || !cleanAddress) {
      setFormError("Заполните название и адрес.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const wasEditing = view !== "list" && editing;
      const object = wasEditing
        ? await updateObject(view.object.id, cleanName, cleanAddress)
        : await createObject(cleanName, cleanAddress);
      setLoadError("");
      setObjects((current) => [...current.filter((item) => item.id !== object.id), object]
        .sort((left, right) => left.name.localeCompare(right.name)));
      setView(wasEditing ? { object } : "list");
      setName(object.name);
      setAddress(object.address);
      setEditing(false);
    } catch {
      setFormError("Не удалось сохранить объект. Проверьте права доступа и попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (object: CrmObject) => {
    if (!window.confirm(`Удалить объект «${object.name}»?`)) return;
    setSaving(true);
    setFormError("");
    try {
      await deleteObject(object.id);
      setObjects((current) => current.filter((item) => item.id !== object.id));
      setView("list");
    } catch {
      setFormError("Не удалось удалить объект. Проверьте права доступа и попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.container} aria-labelledby="objects-title">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Мини-CRM · строительство</span>
          <h1 id="objects-title">{view === "list" ? "Объекты" : view.object.name}</h1>
          <p className={styles.muted}>{profile.display_name} · {isManager ? "Постановщик" : "Исполнитель"}</p>
        </div>
        <button className={styles.secondaryButton} type="button" onClick={onSignOut}>Выйти</button>
      </header>
      {signOutError && <p className={styles.error} role="alert">{signOutError}</p>}

      {view !== "list" && <button className={styles.backButton} type="button" onClick={() => { setView("list"); setEditing(false); setFormError(""); }}>← Все объекты</button>}

      {formError && <p className={styles.error} role="alert">{formError}</p>}

      {view === "list" ? (
        <>
          <div className={styles.listHeading}>
            <p className={styles.muted}>Активные объекты</p>
            {isManager && !editing && <button className={styles.primaryButton} type="button" onClick={startCreate}>Добавить объект</button>}
          </div>
          {editing && (
            <form className={styles.form} onSubmit={handleSave}>
              <h2>Новый объект</h2>
              <ObjectFields name={name} address={address} setName={setName} setAddress={setAddress} />
              <div className={styles.actions}>
                <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Создать"}</button>
                <button className={styles.secondaryButton} type="button" onClick={() => setEditing(false)}>Отмена</button>
              </div>
            </form>
          )}
          {loading ? <p role="status">Загружаем объекты…</p>
            : loadError ? <div className={styles.empty}><p role="alert">{loadError}</p><button className={styles.secondaryButton} type="button" onClick={() => void refreshObjects()}>Повторить</button></div>
              : objects.length === 0 ? <p className={styles.empty}>Пока нет доступных объектов.</p>
                : <ul className={styles.objectList}>{objects.map((object) => <li key={object.id}>
                  <button className={styles.objectLink} type="button" onClick={() => openObject(object)}>
                    <strong>{object.name}</strong><span>{object.address}</span>
                  </button>
                </li>)}</ul>}
        </>
      ) : (
        <>
          <div className={styles.detail}>
            <div><span className={styles.label}>Название</span><p>{view.object.name}</p></div>
            <div><span className={styles.label}>Адрес</span><p>{view.object.address}</p></div>
          </div>
          {isManager && !editing && <div className={styles.actions}>
            <button className={styles.primaryButton} type="button" onClick={() => { setName(view.object.name); setAddress(view.object.address); setEditing(true); setFormError(""); }}>Редактировать</button>
            <button className={styles.dangerButton} type="button" disabled={saving} onClick={() => void handleDelete(view.object)}>Удалить</button>
          </div>}
          {editing && <form className={styles.form} onSubmit={handleSave}>
            <h2>Редактировать объект</h2>
            <ObjectFields name={name} address={address} setName={setName} setAddress={setAddress} />
            <div className={styles.actions}>
              <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "Сохраняем…" : "Сохранить"}</button>
              <button className={styles.secondaryButton} type="button" onClick={() => { setEditing(false); setName(view.object.name); setAddress(view.object.address); setFormError(""); }}>Отмена</button>
            </div>
          </form>}
          <div className={styles.tasks}>
            <TasksPanel objectId={view.object.id} isManager={isManager} />
          </div>
        </>
      )}
    </section>
  );
}

function ObjectFields({ name, address, setName, setAddress }: {
  name: string;
  address: string;
  setName: (value: string) => void;
  setAddress: (value: string) => void;
}) {
  return <>
    <label className={styles.field}>Название
      <input value={name} onChange={(event) => setName(event.target.value)} required />
    </label>
    <label className={styles.field}>Адрес
      <input value={address} onChange={(event) => setAddress(event.target.value)} required />
    </label>
  </>;
}
