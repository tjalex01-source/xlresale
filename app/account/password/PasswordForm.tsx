"use client";

import { useActionState, useState } from "react";

import { FormError, PasswordField, SubmitButton } from "@/components/form";
import { updatePassword, type PasswordState } from "@/app/login/actions";

export function PasswordForm() {
  const [state, action] = useActionState<PasswordState, FormData>(updatePassword, {
    status: "idle",
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <form action={action} className="space-y-4">
      <PasswordField
        label="New password"
        name="password"
        required
        minLength={8}
        autoComplete="new-password"
        autoFocus
        hint="At least 8 characters."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <div>
        <PasswordField
          label="Confirm new password"
          name="confirm_password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          invalid={mismatch}
        />
        {mismatch && (
          <p className="mt-1.5 text-sm text-pink-ink" role="alert">
            Those don&rsquo;t match yet.
          </p>
        )}
      </div>

      {state.status === "error" && <FormError>{state.message}</FormError>}

      <SubmitButton pending="Saving…">Save password</SubmitButton>
    </form>
  );
}
