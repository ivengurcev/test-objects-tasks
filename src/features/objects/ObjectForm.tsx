import type { SubmitEvent } from "react";
import { FormPage } from "../../components/forms/FormPage";
import { FormField } from "../../components/forms/FormField";
import { TextInput } from "../../components/forms/FormControls";
import { FormActions } from "../../components/forms/FormActions";

type Props = {
  mode: "create" | "edit";
  backHref: string;
  name: string;
  address: string;
  nameError: string;
  addressError: string;
  error: string;
  saving: boolean;
  onNameChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

export function ObjectForm({ mode, backHref, name, address, nameError, addressError, error, saving, onNameChange, onAddressChange, onSubmit, onCancel }: Props) {
  return <FormPage title={mode === "create" ? "Создание объекта" : "Редактирование объекта"}
    backLabel={mode === "create" ? "К списку объектов" : "К объекту"} backHref={backHref} onBack={onCancel}
    onSubmit={onSubmit} saving={saving} error={error} actions={<FormActions saving={saving} onCancel={onCancel} />}>
    <FormField id="object-name" label="Название" error={nameError}>
      <TextInput id="object-name" value={name} onChange={(event) => onNameChange(event.target.value)} required
        aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "object-name-error" : undefined} disabled={saving} />
    </FormField>
    <FormField id="object-address" label="Адрес" error={addressError}>
      <TextInput id="object-address" value={address} onChange={(event) => onAddressChange(event.target.value)} required
        aria-invalid={Boolean(addressError)} aria-describedby={addressError ? "object-address-error" : undefined} disabled={saving} />
    </FormField>
  </FormPage>;
}
