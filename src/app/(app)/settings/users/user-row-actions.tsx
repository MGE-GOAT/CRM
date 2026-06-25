"use client";

import { useTransition } from "react";
import { KeyRound } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Field, Input, SubmitButton, Select, ModalForm } from "@/components/ui/form";
import { updateUserRole, toggleUserActive, resetUserPassword } from "@/lib/actions/users";

export function RoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: string;
  disabled: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Select
      defaultValue={role}
      disabled={disabled || pending}
      onChange={(e) => {
        const value = e.target.value;
        start(() => updateUserRole(userId, value));
      }}
      className="w-32"
    >
      <option value="MEMBER">عضو</option>
      <option value="ADMIN">مدیر</option>
      <option value="OWNER">مالک</option>
    </Select>
  );
}

export function ActiveToggle({
  userId,
  isActive,
  disabled,
}: {
  userId: string;
  isActive: boolean;
  disabled: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={disabled || pending}
      onClick={() => start(() => toggleUserActive(userId))}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
        isActive
          ? "bg-green-50 text-green-700 hover:bg-green-100"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      {isActive ? "فعال" : "غیرفعال"}
    </button>
  );
}

export function ResetPasswordButton({ userId }: { userId: string }) {
  return (
    <Modal
      title="بازنشانی گذرواژه"
      trigger={(open) => (
        <button
          onClick={open}
          className="rounded-lg p-1.5 text-muted hover:bg-gray-50 hover:text-text"
          title="بازنشانی گذرواژه"
        >
          <KeyRound size={16} />
        </button>
      )}
    >
      {(close) => (
        <ModalForm action={resetUserPassword.bind(null, userId)} onDone={close}>
          <Field label="گذرواژه جدید">
            <Input name="password" type="password" dir="ltr" required minLength={8} placeholder="حداقل ۸ کاراکتر" />
          </Field>
          <div className="flex justify-end pt-2">
            <SubmitButton>ثبت گذرواژه</SubmitButton>
          </div>
        </ModalForm>
      )}
    </Modal>
  );
}
