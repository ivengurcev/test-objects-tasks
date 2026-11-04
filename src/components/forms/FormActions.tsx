import { Button } from "../Button";
import styles from "./FormActions.module.css";

type Props = { saving: boolean; saveDisabled?: boolean; onCancel: () => void };

export function FormActions({ saving, saveDisabled = false, onCancel }: Props) {
  return <div className={styles.actions}>
    <Button type="submit" disabled={saving || saveDisabled}>{saving ? "Сохраняем…" : "Сохранить"}</Button>
    <Button variant="secondary" disabled={saving} onClick={onCancel}>Отмена</Button>
  </div>;
}
