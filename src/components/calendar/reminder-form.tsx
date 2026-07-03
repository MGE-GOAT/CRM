"use client";

import { useState } from "react";
import { Field, Input, Select, Textarea, SubmitButton } from "@/components/ui/form";
import { DateField } from "@/components/ui/date-field";

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
  const [act, setAct] = useState(values?.action ?? "CALL");
  const [color, setColor] = useState(values?.color ?? "#d4af37");
  const [error, setError] = useState<string | null>(null);
  const needsContact = act !== "GENERAL";
  const needsMessage = act === "WHATSAPP" || act === "SMS";

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
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <input type="hidden" name="color" value={color} />

      <Field label="نوع برنامه">
        <Select name="action" value={act} onChange={(e) => setAct(e.target.value)}>
          <option value="CALL">تماس با مخاطب</option>
          <option value="WHATSAPP">پیام واتساپ به مخاطب</option>
          <option value="SMS">پیامک به مخاطب</option>
          <option value="GENERAL">یادآوری عمومی</option>
        </Select>
      </Field>

      {needsContact && (
        <Field label="مخاطب">
          <Select name="contactId" defaultValue={values?.contactId ?? ""} required>
            <option value="">— انتخاب مخاطب —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="تاریخ">
          <DateField name="date" defaultValue={values?.date ?? defaultDate} />
        </Field>
        <Field label="ساعت">
          <Input name="time" type="time" dir="ltr" defaultValue={values?.time ?? "09:00"} />
        </Field>
      </div>

      <Field label="عنوان (اختیاری)">
        <Input name="title" defaultValue={values?.title ?? ""} placeholder="در صورت خالی بودن، خودکار ساخته می‌شود" />
      </Field>

      {needsMessage && (
        <Field label="متن پیام">
          <Textarea name="messageBody" rows={3} defaultValue={values?.messageBody ?? ""} placeholder="متنی که برای مخاطب ارسال می‌شود…" />
        </Field>
      )}

      <Field label="توضیحات (اختیاری)">
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
