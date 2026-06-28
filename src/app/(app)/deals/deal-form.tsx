"use client";

import { Plus, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea, SubmitButton, ModalForm } from "@/components/ui/form";
import { DateField } from "@/components/ui/date-field";
import { stageLabel, DEAL_SOURCES } from "@/lib/labels";

type Option = { id: string; name: string };

export type DealValues = {
  title: string;
  value: number;
  stage: string;
  probability: number;
  companyId: string | null;
  contactId: string | null;
  expectedCloseDate: string | null;
  notes: string | null;
  source: string | null;
};

const STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

export function DealForm({
  action,
  companies,
  contacts,
  values,
  mode,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  companies: Option[];
  contacts: Option[];
  values?: DealValues;
  mode: "create" | "edit";
}) {
  return (
    <Modal
      title={mode === "create" ? "معامله جدید" : "ویرایش معامله"}
      trigger={(open) =>
        mode === "create" ? (
          <button
            onClick={open}
            className="btn-gold inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
          >
            <Plus size={16} /> معامله جدید
          </button>
        ) : (
          <button
            onClick={open}
            className="rounded p-1 text-muted hover:bg-gray-50 hover:text-text"
            aria-label="ویرایش معامله"
            title="ویرایش"
          >
            <Pencil size={14} />
          </button>
        )
      }
    >
      {(close) => (
        <ModalForm action={action} onDone={close}>
          <Field label="عنوان معامله">
            <Input name="title" required defaultValue={values?.title} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="مبلغ (تومان)">
              <Input
                name="value"
                type="text"
                inputMode="numeric"
                dir="ltr"
                placeholder="مثلاً ۱۰۰۰۰۰۰۰"
                defaultValue={values?.value ?? ""}
              />
            </Field>
            <Field label="احتمال موفقیت (٪)">
              <Input
                name="probability"
                type="text"
                inputMode="numeric"
                dir="ltr"
                defaultValue={values?.probability ?? 10}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="مرحله">
              <Select name="stage" defaultValue={values?.stage ?? "LEAD"}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {stageLabel[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="تاریخ بسته شدن (تخمینی)">
              <DateField
                name="expectedCloseDate"
                defaultValue={values?.expectedCloseDate}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <Field label="مخاطب">
              <Select name="contactId" defaultValue={values?.contactId ?? ""}>
                <option value="">— بدون مخاطب —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="منبع / کمپین">
            <Select name="source" defaultValue={values?.source ?? ""}>
              <option value="">— نامشخص —</option>
              {DEAL_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="یادداشت">
            <Textarea name="notes" rows={2} defaultValue={values?.notes ?? ""} />
          </Field>
          <div className="flex justify-end pt-2">
            <SubmitButton>
              {mode === "create" ? "ایجاد معامله" : "ذخیره تغییرات"}
            </SubmitButton>
          </div>
        </ModalForm>
      )}
    </Modal>
  );
}
