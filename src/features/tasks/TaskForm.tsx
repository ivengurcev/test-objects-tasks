import type { SubmitEvent } from "react";
import { FormPage } from "../../components/forms/FormPage";
import { FormField } from "../../components/forms/FormField";
import { TextInput, TextArea, Select } from "../../components/forms/FormControls";
import { FormActions } from "../../components/forms/FormActions";
import type { ExecutorProfile } from "./tasksApi";
import styles from "../../components/forms/FormPage.module.css";

type Props = {
  mode: "create" | "edit";
  backHref: string;
  title: string;
  description: string;
  assigneeId: string;
  titleError: string;
  assigneeError: string;
  executorError: string;
  executors: ExecutorProfile[];
  executorsLoading: boolean;
  error: string;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onAssigneeChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

export function TaskForm({ mode, backHref, title, description, assigneeId, titleError, assigneeError, executorError, executors, executorsLoading, error, saving, onTitleChange, onDescriptionChange, onAssigneeChange, onSubmit, onCancel }: Props) {
  return <FormPage title={mode === "create" ? "Создание задачи" : "Редактирование задачи"}
    backLabel={mode === "create" ? "К объекту" : "К задаче"} backHref={backHref} onBack={onCancel}
    onSubmit={onSubmit} saving={saving} error={error}
    actions={<FormActions saving={saving} saveDisabled={executorsLoading || executors.length === 0} onCancel={onCancel} />}>
    <FormField id="task-title" label="Название" error={titleError}>
      <TextInput id="task-title" value={title} onChange={(event) => onTitleChange(event.target.value)} required
        aria-invalid={Boolean(titleError)} aria-describedby={titleError ? "task-title-error" : undefined} disabled={saving} />
    </FormField>
    <FormField id="task-description" label="Описание">
      <TextArea id="task-description" style={{ minHeight: 180 }} rows={3} value={description} onChange={(event) => onDescriptionChange(event.target.value)} disabled={saving} />
    </FormField>
    <FormField id="task-assignee" label="Исполнитель" error={assigneeError}>
      <Select id="task-assignee" value={assigneeId} onChange={(event) => onAssigneeChange(event.target.value)} required
        aria-invalid={Boolean(assigneeError || executorError)}
        aria-describedby={[assigneeError && "task-assignee-error", executorError && "task-executor-error"].filter(Boolean).join(" ") || undefined}
        disabled={saving || executorsLoading || executors.length === 0}>
        <option value="" disabled>Выберите исполнителя</option>
        {executors.map((executor) => <option key={executor.id} value={executor.id}>{executor.display_name}</option>)}
      </Select>
    </FormField>
    {executorError && <p id="task-executor-error" className={styles.error} role="alert">{executorError}</p>}
    {executorsLoading && <p className={styles.status} role="status">Загружаем исполнителей…</p>}
    {!executorsLoading && !executorError && executors.length === 0 && <p className={styles.status}>Нет доступных исполнителей.</p>}
  </FormPage>;
}
