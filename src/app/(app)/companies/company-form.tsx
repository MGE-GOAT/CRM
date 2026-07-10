"use client";

import { Plus, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea, SubmitButton, ModalForm } from "@/components/ui/form";

export type CompanyValues = {
  name: string;
  industry: string | null;
  senf: string | null;
  domain: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

export function CompanyForm({
  action,
  values,
  mode,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  values?: CompanyValues;
  mode: "create" | "edit";
}) {
  return (
    <Modal
      title={mode === "create" ? "شرکت جدید" : "ویرایش شرکت"}
      trigger={(open) =>
        mode === "create" ? (
          <button
            onClick={open}
            className="btn-gold inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
          >
            <Plus size={16} /> شرکت جدید
          </button>
        ) : (
          <button
            onClick={open}
            className="rounded-lg p-1.5 text-muted hover:bg-[var(--gold-tint)] hover:text-text"
            title="ویرایش"
            aria-label="ویرایش"
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
        )
      }
    >
      {(close) => (
        <ModalForm action={action} onDone={close}>
          <Field label="نام شرکت">
            <Input name="name" required defaultValue={values?.name} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="صنعت">
              <Input name="industry" defaultValue={values?.industry ?? ""} />
            </Field>
            <Field label="دامنه">
              <Input name="domain" dir="ltr" placeholder="acme.com" defaultValue={values?.domain ?? ""} />
            </Field>
          </div>
          <Field label="صنف">
            <Input name="senf" defaultValue={values?.senf ?? ""} placeholder="مثلاً پوشاک، مواد غذایی…" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="وب‌سایت">
              <Input name="website" dir="ltr" defaultValue={values?.website ?? ""} />
            </Field>
            <Field label="تلفن">
              <Input name="phone" dir="ltr" defaultValue={values?.phone ?? ""} />
            </Field>
          </div>
          <Field label="آدرس">
            <Input name="address" defaultValue={values?.address ?? ""} />
          </Field>
          <Field label="یادداشت">
            <Textarea name="notes" rows={3} defaultValue={values?.notes ?? ""} />
          </Field>
          <div className="flex justify-end pt-2">
            <SubmitButton>
              {mode === "create" ? "ایجاد شرکت" : "ذخیره تغییرات"}
            </SubmitButton>
          </div>
        </ModalForm>
      )}
    </Modal>
  );
}
