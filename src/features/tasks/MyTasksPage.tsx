import { useCallback, useEffect, useMemo, useState } from "react";
import { navigate, usePathname } from "../../app/navigation";
import { getPathForRole, parseRoute } from "../../app/routes";
import { Button } from "../../components/Button";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { TaskListIcon } from "../../components/Icons";
import type { Profile } from "../objects/types";
import { TaskDetails } from "./TaskDetails";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { groupMyTasks, type MyTask, type MyTaskGroup } from "./myTasksModel";
import { listMyTasks, type TaskStatus } from "./tasksApi";
import styles from "./MyTasksPage.module.css";

type Props = {
  profile: Profile;
  signOutError: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? `Не удалось загрузить задачи. ${error.message}`
    : "Не удалось загрузить задачи. Проверьте подключение и попробуйте ещё раз.";
}

function TaskGroups({ groups, accepted = false }: { groups: MyTaskGroup[]; accepted?: boolean }) {
  return <div className={styles.groups}>{groups.map((group) => <section key={group.objectId} aria-label={`Объект ${group.name}`}>
    <header className={styles.groupHeader}>
      <div className={styles.objectInfo}><h2>{group.name}</h2><p>{group.address}</p></div>
      <span className={styles.groupCount}>{accepted ? "Принятых задач" : "Активных задач"}: {group.tasks.length}</span>
    </header>
    <DataTable
      label={`${accepted ? "Принятые" : "Активные"} задачи объекта ${group.name}`}
      headers={[{ label: "Название задачи" }, { label: "Статус" }]}
      columns="minmax(0, 1fr) 160px 20px"
      className={styles.taskTableLayout}
      items={group.tasks}
      href={(task) => `/my-tasks/${task.id}`}
      onNavigate={(task) => navigate(`/my-tasks/${task.id}`)}
      emptyState={<EmptyState title="Задач пока нет" />}
      renderRow={(task) => <>
        <strong className={styles.taskTitle}>{task.title}</strong>
        <span className={styles.taskStatus}><TaskStatusBadge status={task.status} /></span>
      </>}
    />
  </section>)}</div>;
}

export function MyTasksPage({ profile, signOutError }: Props) {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const pathname = usePathname();
  const route = parseRoute(getPathForRole(profile.role, pathname));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [acceptedExpanded, setAcceptedExpanded] = useState(false);
  const { activeGroups, acceptedGroups } = useMemo(() => groupMyTasks(tasks), [tasks]);
  const activeCount = activeGroups.reduce((total, group) => total + group.tasks.length, 0);
  const acceptedCount = acceptedGroups.reduce((total, group) => total + group.tasks.length, 0);

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
  }, [refreshTasks, pathname]);

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status } : task));
  };

  return <section className={styles.page} aria-label="Мои задачи">
    {signOutError && <p className={styles.error} role="alert">{signOutError}</p>}
    {route.kind === "my-task" ? <TaskDetails
      key={route.taskId}
      taskId={route.taskId}
      isManager={false}
      backHref="/my-tasks"
      backLabel="К моим задачам"
      onBack={() => navigate("/my-tasks")}
      onStatusChange={handleStatusChange}
      onDataChange={() => void refreshTasks()}
    /> : <>
      <header className={styles.pageHeader}>
        <h1>Мои задачи</h1>
        <p>{loading ? "Загружаем задачи…" : loadError ? "Количество задач недоступно" : `Активных задач: ${activeCount} · Объектов: ${activeGroups.length}`}</p>
      </header>
      {loading ? <p className={styles.muted} role="status">Загружаем задачи…</p>
        : loadError ? <div className={styles.empty} role="alert"><EmptyState title="Не удалось загрузить задачи" description={loadError}
          action={<Button variant="secondary" onClick={() => void refreshTasks()}>Повторить</Button>} /></div>
          : <>
            {activeCount === 0 ? <div className={styles.empty}><EmptyState icon={<TaskListIcon />} title="Активных задач нет" /></div>
              : <TaskGroups groups={activeGroups} />}
            {acceptedCount > 0 && <section className={styles.accepted} aria-label="Принятые задачи">
              <Button variant="secondary" aria-expanded={acceptedExpanded} aria-controls="accepted-tasks"
                onClick={() => setAcceptedExpanded((expanded) => !expanded)}>Принятые задачи ({acceptedCount})</Button>
              {acceptedExpanded && <div id="accepted-tasks" className={styles.acceptedGroups}><TaskGroups groups={acceptedGroups} accepted /></div>}
            </section>}
          </>}
    </>}
  </section>;
}
