"use client";

import { useState } from "react";
import { Field, Input, Textarea, SubmitButton } from "@/components/ui/form";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";

export type ContactOption = { id: string; name: string };

export type ReminderValues = {
  title: string | null;
  description: string | null;
  date: string; // yyyy-mm-dd
  time: string; // HH:MM
  isPublic: boolean;
  color: string;
  action: string;
  contactId: string | null;
  messageBody: string | null;
};

const COLORS = ["#d4af37", "#0ea5e9", "#10b981", "#ef4444", "#8b5cf6"];

export function ReminderForm({
  action,
  onDone,
  contacts,
  values,
  defaultDate,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  onDone: () => void;
  contacts: ContactOption[];
  values?: ReminderValues;
  defaultDate?: string;
}) {
  const [color, setColor] = useState(values?.color ?? "#d4af37");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (fd) => {
        setError(null);
        try {
          const res = await action(fd);
          if (res?.error) {
            setError(res.error);
            return;
          }
          onDone();
        } catch (e) {
          setError(e instanceof Error ? e.message : "خطایی رخ داد.");
        }
      }}
      className="space-y-4"
    >
      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <input type="hidden" name="color" value={color} />

      {/* When editing an existing reminder, preserve any outreach data the
          simplified form no longer exposes (action/contact/message). New
          reminders omit these, so the server defaults action to GENERAL. */}
      {values && (
        <>
          <input type="hidden" name="action" value={values.action} />
          {values.contactId && (
            <input type="hidden" name="contactId" value={values.contactId} />
          )}
          {values.messageBody && (
            <input type="hidden" name="messageBody" value={values.messageBody} />
          )}
        </>
      )}

      <Field label="عنوان">
        <Input name="title" required defaultValue={values?.title ?? ""} placeholder="مثلاً پیگیری سفارش" />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="تاریخ">
          <DateField name="date" defaultValue={values?.date ?? defaultDate} />
        </Field>
        <Field label="ساعت">
          <TimeField name="time" defaultValue={values?.time ?? "09:00"} />
        </Field>
      </div>

      <Field label="یادداشت (اختیاری)">
        <Textarea name="description" rows={2} defaultValue={values?.description ?? ""} />
      </Field>

      <div className="flex items-center justify-between">
        <div>
          <span className="mb-1 block text-sm font-medium">رنگ</span>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`رنگ ${c}`}
                className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-text" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isPublic"
            defaultChecked={values?.isPublic ?? false}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          نمایش برای کل تیم
        </label>
      </div>

      <div className="flex justify-end pt-2">
        <SubmitButton>ذخیره برنامه</SubmitButton>
      </div>
    </form>
  );
}
