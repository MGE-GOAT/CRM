"use client";

import { useRef, useState } from "react";
import { Select, Textarea, SubmitButton } from "@/components/ui/form";
import { logActivity } from "@/lib/actions/activities";

export function LogActivity({
  contactId,
  companyId,
  dealId,
}: {
  contactId?: string;
  companyId?: string;
  dealId?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        setError(null);
        const result = await logActivity(fd);
        if (result?.error) {
          setError(result.error);
          return;
        }
        ref.current?.reset();
      }}
      className="space-y-3 rounded-xl border border-border bg-surface p-4"
    >
      {contactId && <input type="hidden" name="contactId" value={contactId} />}
      {companyId && <input type="hidden" name="companyId" value={companyId} />}
      {dealId && <input type="hidden" name="dealId" value={dealId} />}
      <Textarea
        name="content"
        rows={2}
        required
        placeholder="ثبت یادداشت، تماس، ایمیل یا جلسه…"
      />
      <div className="flex items-center justify-between gap-2">
        <Select name="type" defaultValue="NOTE" className="w-40">
          <option value="NOTE">یادداشت</option>
          <option value="CALL">تماس</option>
          <option value="EMAIL">ایمیل</option>
          <option value="MEETING">جلسه</option>
        </Select>
        <SubmitButton>ثبت فعالیت</SubmitButton>
      </div>
      {error && (
        <p role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
