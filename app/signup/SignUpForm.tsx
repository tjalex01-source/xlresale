"use client";

import { useActionState } from "react";

import { CheckYourEmail, Field, FormError, SubmitButton } from "@/components/form";
import { USERNAME_HINT } from "@/lib/username";
import { signUp, type SignUpState } from "./actions";

export function SignUpForm() {
  const [state, action] = useActionState<SignUpState, FormData>(signUp, { status: "idle" });

  if (state.status === "sent") {
    return (
      <CheckYourEmail email={state.email}>
        Open the link to confirm your address and finish setting up your account. It expires in
        an hour.
      </CheckYourEmail>
    );
  }

  const field = state.status === "error" ? state.field : undefined;

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Pick a handle"
        name="username"
        prefix="@"
        required
        maxLength={20}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="saturdayhunter"
        hint={`${USERNAME_HINT} This is your public profile at xlresale.com/u/…`}
        invalid={field === "username"}
      />

      <Field
        label="Email address"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        invalid={field === "email"}
      />

      <Field
        label="Password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        hint="At least 8 characters."
        invalid={field === "password"}
      />

      {state.status === "error" && <FormError>{state.message}</FormError>}

      <SubmitButton pending="Creating…">Create account</SubmitButton>
    </form>
  );
}
