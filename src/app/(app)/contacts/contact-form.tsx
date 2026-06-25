"use client";

import { Plus, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea, SubmitButton, ModalForm } from "@/components/ui/form";

type CompanyOption = { id: string; name: string };

export type ContactValues = {
  id?: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  companyId: string | null;
  notes: string | null;
};

export function ContactForm({
  action,
  companies,
  values,
  mode,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  companies: CompanyOption[];
  values?: ContactValues;
  mode: "create" | "edit";
}) {
  return (
    <Modal
      title={mode === "create" ? "مخاطب جدید" : "ویرایش مخاطب"}
      trigger={(open) =>
        mode === "create" ? (
          <button
            onClick={open}
            className="btn-gold inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
          >
            <Plus size={16} /> مخاطب جدید
          </button>
        ) : (
          <button
            onClick={open}
            className="rounded-lg p-1.5 text-muted hover:bg-gray-50 hover:text-text"
            title="ویرایش"
          >
            <Pencil size={16} />
          </button>
        )
      }
    >
      {(close) => (
        <ModalForm action={action} onDone={close}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="نام">
              <Input name="firstName" required defaultValue={values?.firstName} />
            </Field>
            <Field label="نام خانوادگی">
              <Input name="lastName" required defaultValue={values?.lastName} />
            </Field>
          </div>
          <Field label="ایمیل">
            <Input name="email" type="email" dir="ltr" defaultValue={values?.email ?? ""} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="تلفن">
              <Input name="phone" dir="ltr" defaultValue={values?.phone ?? ""} />
            </Field>
            <Field label="سمت">
              <Input name="title" defaultValue={values?.title ?? ""} />
            </Field>
          </div>
          <Field label="شرکت">
            <Select name="companyId" defaultValue={values?.companyId ?? ""}>
              <option value="">— بدون شرکت —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="یادداشت">
            <Textarea name="notes" rows={3} defaultValue={values?.notes ?? ""} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <SubmitButton>
              {mode === "create" ? "ایجاد مخاطب" : "ذخیره تغییرات"}
            </SubmitButton>
          </div>
        </ModalForm>
      )}
    </Modal>
  );
}
