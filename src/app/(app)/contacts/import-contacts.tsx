"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { importContacts, type ImportResult } from "@/lib/actions/contacts";
import { toFa } from "@/lib/format";

export function ImportContacts() {
  return (
    <Modal
      title="ورود مخاطبین از فایل"
      trigger={(open) => (
        <button
          onClick={open}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-[var(--gold-tint)]"
        >
          <Upload size={16} /> ورود مخاطبین
        </button>
      )}
    >
      {(close) => <ImportForm onDone={close} />}
    </Modal>
  );
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);
  const router = useRouter();
  const done = result?.imported !== undefined;

  return (
    <form
      action={(fd) => start(async () => setResult(await importContacts(fd)))}
      className="space-y-4"
    >
      <div className="rounded-lg bg-surface-2 p-3 text-sm leading-relaxed text-muted">
        <p className="font-medium text-text">تهیهٔ فایل مخاطبین (فایل vCard/‏.vcf):</p>
        <p className="mt-1">
          <b>از خود آیفون:</b> برنامهٔ رایگان <span dir="ltr">«My Contacts Backup»</span> را نصب کنید ← <b>Backup</b>
          ← فایل را در <b>Files</b> ذخیره کنید. سپس همان فایل را اینجا بارگذاری کنید.
        </p>
        <p className="mt-1">
          <b>یا با رایانه:</b> <span dir="ltr">iCloud.com</span> ← <b>Contacts</b> ← انتخاب همه
          <span dir="ltr"> (Ctrl/Cmd + A) </span> ← ⚙ ← <b>Export vCard</b>. فایل <span dir="ltr">CSV</span> هم پشتیبانی می‌شود.
        </p>
      </div>

      <input
        type="file"
        name="file"
        accept=".vcf,.csv,.txt,text/vcard,text/x-vcard,text/directory,text/csv,text/plain,application/octet-stream"
        required
        disabled={pending || done}
        className="block w-full rounded-lg border border-border p-2 text-sm file:me-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[var(--brand)] file:px-4 file:py-2 file:text-white"
      />

      <p className="text-xs text-muted">مخاطبین تکراری (شماره یا ایمیل موجود) به‌صورت خودکار نادیده گرفته می‌شوند.</p>

      {result?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {result.error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          ✅ {toFa(result!.imported!)} مخاطب وارد شد
          {result!.duplicates ? ` · ${toFa(result!.duplicates)} مورد تکراری رد شد` : ""}.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {done ? (
          <button
            type="button"
            onClick={() => {
              router.refresh();
              onDone();
            }}
            className="btn-gold rounded-lg px-4 py-2 text-sm"
          >
            پایان
          </button>
        ) : (
          <button type="submit" disabled={pending} className="btn-gold rounded-lg px-4 py-2 text-sm disabled:opacity-60">
            {pending ? "در حال ورود…" : "بارگذاری و ورود"}
          </button>
        )}
      </div>
    </form>
  );
}
