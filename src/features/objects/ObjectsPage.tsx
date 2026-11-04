import { useEffect, useState, type SubmitEvent } from "react";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { ArrowLeftIcon } from "../../components/Icons";
import { ObjectForm } from "./ObjectForm";
import type { Profile } from "./types";
import styles from "./ObjectsPage.module.css";
import { createObject, deleteObject, listActiveTaskStatuses, listObjects, updateObject, type CrmObject } from "./objectsApi";
import { navigate, usePathname } from "../../app/navigation";
import { parseRoute } from "../../app/routes";
import { TasksPanel, type TaskPanelView } from "../tasks/TasksPanel";

type Props = {
  profile: Profile;
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

export function ObjectsPage({ profile, signOutError }: Props) {
  const isManager = profile.role === "manager";
  const [objects, setObjects] = useState<CrmObject[]>([]);
  const pathname = usePathname();
  const route = parseRoute(pathname);
  const objectId = route.kind === "object" || route.kind === "task" ? route.objectId : null;
  const selectedObject = objects.find((object) => object.id === objectId);
  const [formView, setFormView] = useState<{ path: string; view: View } | null>(null);
  const view: View = formView?.path === pathname ? formView.view
    : selectedObject ? { kind: "object", object: selectedObject } : { kind: "list" };
  const setView = (next: View) => {
    if (next.kind === "object-form") setFormView({ path: pathname, view: next });
    else {
      setFormView(null);
      navigate(next.kind === "object" ? `/objects/${next.object.id}` : "/objects");
    }
  };
  useEffect(() => { setFormView(null); setFormError(""); }, [pathname]);
  const [taskView, setTaskView] = useState<TaskPanelView>({ kind: "list" });
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

  useEffect(() => {
    void refreshObjects();
    void refreshTaskCounts();
  }, [pathname]);

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
    setView(view.kind === "object-form" && view.mode === "edit"
      ? { kind: "object", object: view.object }
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
  const isObjectScreen = view.kind === "object" && taskView.kind === "list";
  const showObjectError = view.kind === "object" && taskView.kind === "list";

  return (
    <section className={isFormScreen ? styles.formContainer : (isObjectScreen || (view.kind === "object" && taskView.kind === "card")) ? styles.objectPage : view.kind === "list" && !objectId ? styles.listContainer : styles.container} aria-label="Мини-CRM">
      {isObjectScreen && <nav className={styles.navigation} aria-label="Навигация приложения">
        <div>
          {isObjectScreen && <a className={styles.objectBackLink} href="/objects" onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault(); setView({ kind: "list" }); setTaskView({ kind: "list" }); setFormError("");
          }}><ArrowLeftIcon /><span>К списку объектов</span></a>}
        </div>
      </nav>}
      {signOutError && <p className={styles.error} role="alert">{signOutError}</p>}
      {showObjectError && formError && <p className={styles.error} role="alert">{formError}</p>}

      {objectId && !selectedObject ? <>
        <button className={styles.backButton} type="button" onClick={() => navigate(isManager ? "/objects" : "/my-tasks")}>← Назад</button>
        {loading ? <p role="status">Загружаем объект…</p> : <div className={styles.empty}>
          <p role="alert">{loadError || "Объект недоступен, удалён или не найден."}</p>
          {loadError && <button className={styles.secondaryButton} onClick={() => void refreshObjects()}>Повторить</button>}
        </div>}
      </> : view.kind === "list" ? <>
        <header className={styles.listHeading}>
          <div><h1>Объекты</h1><p className={styles.muted}>{loading ? "Загружаем…" : loadError ? "Количество недоступно" : `Активных объектов: ${objects.length}`}</p></div>
          {isManager && <Button onClick={startCreate}>+ Создать объект</Button>}
        </header>
        {loading ? <p role="status">Загружаем объекты…</p>
          : loadError ? <div className={styles.empty}><p role="alert">{loadError}</p><button className={styles.secondaryButton} type="button" onClick={() => void refreshObjects()}>Повторить</button></div>
            : <DataTable
              label="Объекты"
              headers={[{ label: "Объект" }, { label: "На проверке", align: "center" }, { label: "Выполнено", align: "center" }, { label: "Открыто", align: "center" }]}
              columns="minmax(0, 1fr) repeat(3, 130px) 28px"
              className={styles.objectTableLayout}
              items={objects}
              href={(object) => `/objects/${object.id}`}
              onNavigate={openObject}
              emptyState={<EmptyState title="Пока нет доступных объектов." />}
              notice={(countsLoading || countsError) && <p className={countsError ? styles.countError : styles.countState} role="status">{countsLoading ? "Обновляем счётчики…" : "Счётчики недоступны"}</p>}
              renderRow={(object) => <>
                <span className={styles.objectInfo}><strong>{object.name}</strong><span className={styles.objectAddress}>{object.address}</span></span>
                <span className={styles.counts}>
                  <span className={(taskCounts[object.id]?.review ?? 0) > 0 ? styles.reviewCount : styles.emptyCount}><span className={styles.mobileLabel}>На проверке: </span><span>{countsLoading || countsError ? "—" : taskCounts[object.id]?.review ?? 0}</span></span>
                  <span className={(taskCounts[object.id]?.completed ?? 0) > 0 ? styles.completedCount : styles.emptyCount}><span className={styles.mobileLabel}>Выполнено: </span><span>{countsLoading || countsError ? "—" : taskCounts[object.id]?.completed ?? 0}</span></span>
                  <span className={(taskCounts[object.id]?.open ?? 0) > 0 ? styles.openCount : styles.emptyCount}><span className={styles.mobileLabel}>Открыто: </span><span>{countsLoading || countsError ? "—" : taskCounts[object.id]?.open ?? 0}</span></span>
                </span>
              </>}
            />}
      </> : view.kind === "object-form" ? <ObjectForm
        mode={view.mode}
        backHref={view.mode === "edit" ? `/objects/${view.object.id}` : "/objects"}
        name={name} address={address} nameError={nameError} addressError={addressError}
        error={formError} saving={saving}
        onNameChange={(value) => { setName(value); setNameError(""); }}
        onAddressChange={(value) => { setAddress(value); setAddressError(""); }}
        onSubmit={handleSaveObject} onCancel={cancelObjectForm}
      /> : <>
        {taskView.kind === "list" && <header className={styles.objectHeader}>
          <div className={styles.objectSummary}>
            <h1>{view.object.name}</h1>
            <p>{view.object.address}</p>
          </div>
          {isManager && <div className={styles.objectActions}>
            <button className={styles.editObjectButton} type="button" onClick={() => startEdit(view.object)}>Редактировать</button>
            <button className={styles.deleteObjectButton} type="button" disabled={saving} onClick={() => void handleDeleteObject(view.object)}>Удалить</button>
          </div>}
        </header>}
        {view.kind === "object" && <div className={taskView.kind === "list" ? styles.objectTasks : undefined}>
          <TasksPanel
            key={view.object.id}
            objectId={view.object.id}
            isManager={isManager}
            onViewChange={setTaskView}
            onDataChange={() => void refreshTaskCounts()}
          />
        </div>}
      </>}
    </section>
  );
}
