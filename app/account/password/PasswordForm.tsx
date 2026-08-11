"use client";

import { useActionState } from "react";

import { Field, FormError, SubmitButton } from "@/components/form";
import { updatePassword, type PasswordState } from "@/app/login/actions";

export function PasswordForm() {
  const [state, action] = useActionState<PasswordState, FormData>(updatePassword, {
    status: "idle",
  });

  return (
    <form action={action} className="space-y-4">
      <Field
        label="New password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        autoFocus
        hint="At least 8 characters."
      />

      {state.status === "error" && <FormError>{state.message}</FormError>}

      <SubmitButton pending="Saving…">Save password</SubmitButton>
    </form>
  );
}
