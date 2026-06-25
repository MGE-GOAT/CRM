"use client";

import { UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, SubmitButton, ModalForm } from "@/components/ui/form";
import { createUser } from "@/lib/actions/users";

export function UserForm() {
  return (
    <Modal
      title="افزودن عضو تیم"
      trigger={(open) => (
        <button
          onClick={open}
          className="btn-gold inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
        >
          <UserPlus size={16} /> افزودن عضو
        </button>
      )}
    >
      {(close) => (
        <ModalForm action={createUser} onDone={close}>
          <Field label="نام و نام خانوادگی">
            <Input name="name" required placeholder="مثلاً علی رضایی" />
          </Field>
          <Field label="ایمیل">
            <Input name="email" type="email" dir="ltr" required placeholder="ali@company.com" />
          </Field>
          <Field label="گذرواژه موقت">
            <Input name="password" type="text" dir="ltr" required minLength={8} placeholder="حداقل ۸ کاراکتر" />
          </Field>
          <Field label="نقش">
            <Select name="role" defaultValue="MEMBER">
              <option value="MEMBER">عضو</option>
              <option value="ADMIN">مدیر</option>
              <option value="OWNER">مالک</option>
            </Select>
          </Field>
          <div className="flex justify-end pt-2">
            <SubmitButton>ایجاد کاربر</SubmitButton>
          </div>
        </ModalForm>
      )}
    </Modal>
  );
}
