import { useCallback, useEffect, useMemo, useState } from "react";
import type { Profile } from "../objects/types";
import { TaskDetails } from "./TaskDetails";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { groupTasksByObject, type MyTask } from "./myTasksModel";
import { listMyTasks, type TaskStatus } from "./tasksApi";
import styles from "./MyTasksPage.module.css";

type Props = {
  profile: Profile;
  onSignOut: () => void;
  signOutError: string;
};

type View = { kind: "list" } | { kind: "task"; taskId: string };

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? `Не удалось загрузить задачи. ${error.message}`
    : "Не удалось загрузить задачи. Проверьте подключение и попробуйте ещё раз.";
}

export function MyTasksPage({ profile, onSignOut, signOutError }: Props) {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [view, setView] = useState<View>({ kind: "list" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const groups = useMemo(() => groupTasksByObject(tasks), [tasks]);

  const refreshTasks = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setTasks(await listMyTasks(profile.id));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [profile.id]);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status } : task));
  };

  const backToList = () => {
    setView({ kind: "list" });
    void refreshTasks();
  };

  return (
    <section className={styles.container} aria-label="Мои задачи">
      <div className={styles.utilityBar}>
        <span>Мини-CRM · строительство</span>
        <span>{profile.display_name} · Исполнитель</span>
      </div>
      <nav className={styles.navigation} aria-label="Навигация приложения">
        <div>
          {view.kind === "task" && <button className={styles.backButton} type="button" onClick={backToList}>← Назад к моим задачам</button>}
        </div>
        <button className={styles.secondaryButton} type="button" onClick={onSignOut}>Выйти</button>
      </nav>
      {signOutError && <p className={styles.error} role="alert">{signOutError}</p>}

      {view.kind === "list" ? <>
        <header className={styles.sectionHeader}><h1>Мои задачи</h1></header>
        {loading ? <p className={styles.muted} role="status">Загружаем задачи…</p>
          : loadError ? <div className={styles.notice}>
            <p role="alert">{loadError}</p>
            <button className={styles.secondaryButton} type="button" onClick={() => void refreshTasks()}>Повторить</button>
          </div>
            : groups.length === 0 ? <p className={styles.notice}>У вас пока нет активных задач.</p>
              : <div className={styles.groups}>{groups.map((group) => <section className={styles.group} key={group.objectId}>
                <header className={styles.groupHeader}>
                  <h2>{group.name}</h2>
                  <p>{group.address}</p>
                </header>
                <ul className={styles.taskList}>{group.tasks.map((task) => <li key={task.id}>
                  <button className={styles.taskLink} type="button" onClick={() => setView({ kind: "task", taskId: task.id })}>
                    <span>{task.title}</span><TaskStatusBadge status={task.status} />
                  </button>
                </li>)}</ul>
              </section>)}</div>}
      </> : <TaskDetails
        key={view.taskId}
        taskId={view.taskId}
        isManager={false}
        onStatusChange={handleStatusChange}
        onDataChange={() => void refreshTasks()}
      />}
    </section>
  );
}
