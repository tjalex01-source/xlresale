"use client";

import { useActionState } from "react";

import { CheckYourEmail, Field, FormError, SubmitButton } from "@/components/form";
import { requestPasswordReset, type ResetState } from "../login/actions";

export function ResetForm() {
  const [state, action] = useActionState<ResetState, FormData>(requestPasswordReset, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <CheckYourEmail email={state.email}>
        If that address has an account, the link is on its way. It expires in an hour.
      </CheckYourEmail>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Email address"
        name="email"
        type="email"
        required
        autoComplete="email"
        autoFocus
        placeholder="you@example.com"
      />

      {state.status === "error" && <FormError>{state.message}</FormError>}

      <SubmitButton pending="Sending…">Email me a reset link</SubmitButton>
    </form>
  );
}
