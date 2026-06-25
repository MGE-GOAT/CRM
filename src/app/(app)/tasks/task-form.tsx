"use client";

import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea, SubmitButton, ModalForm } from "@/components/ui/form";
import { DateField } from "@/components/ui/date-field";

type Option = { id: string; name: string };

export function TaskForm({
  action,
  users,
  deals,
  contacts,
  currentUserId,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  users: Option[];
  deals: Option[];
  contacts: Option[];
  currentUserId: string;
}) {
  return (
    <Modal
      title="وظیفه جدید"
      trigger={(open) => (
        <button
          onClick={open}
          className="btn-gold inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
        >
          <Plus size={16} /> وظیفه جدید
        </button>
      )}
    >
      {(close) => (
        <ModalForm action={action} onDone={close}>
          <Field label="عنوان">
            <Input name="title" required placeholder="پیگیری با…" />
          </Field>
          <Field label="توضیحات">
            <Textarea name="description" rows={2} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="مسئول">
              <Select name="assigneeId" defaultValue={currentUserId}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="اولویت">
              <Select name="priority" defaultValue="MEDIUM">
                <option value="LOW">کم</option>
                <option value="MEDIUM">متوسط</option>
                <option value="HIGH">زیاد</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="مهلت انجام">
              <DateField name="dueDate" />
            </Field>
            <Field label="معامله مرتبط">
              <Select name="dealId" defaultValue="">
                <option value="">— بدون معامله —</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="مخاطب مرتبط">
            <Select name="contactId" defaultValue="">
              <option value="">— بدون مخاطب —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end pt-2">
            <SubmitButton>ایجاد وظیفه</SubmitButton>
          </div>
        </ModalForm>
      )}
    </Modal>
  );
}
