"use client";

import { useActionState, useState } from "react";

import { CheckYourEmail, Field, FormError, PasswordField, SubmitButton } from "@/components/form";
import { Turnstile } from "@/components/Turnstile";
import { USERNAME_HINT } from "@/lib/username";
import { signUp, type SignUpState } from "./actions";

export function SignUpForm() {
  const [state, action] = useActionState<SignUpState, FormData>(signUp, { status: "idle" });
  // Controlled on purpose: React resets a form after an action runs, so an
  // uncontrolled field would be wiped every time the server rejects a submit —
  // making the user retype their handle to read "that handle is taken".
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  if (state.status === "sent") {
    return (
      <CheckYourEmail email={state.email}>
        Open the link to confirm your address and finish setting up your account. It expires in
        an hour.
      </CheckYourEmail>
    );
  }

  const field = state.status === "error" ? state.field : undefined;
  // Only complain once they've actually typed something in the second box —
  // flagging a mismatch after the first keystroke is just nagging.
  const mismatch = confirm.length > 0 && password !== confirm;

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
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        invalid={field === "username"}
      />

      <Field
        label="Email address"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        invalid={field === "email"}
      />

      <PasswordField
        label="Password"
        name="password"
        required
        minLength={8}
        autoComplete="new-password"
        hint="At least 8 characters."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        invalid={field === "password"}
      />

      <div>
        <PasswordField
          label="Confirm password"
          name="confirm_password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          invalid={mismatch || field === "confirm_password"}
        />
        {mismatch && (
          <p className="mt-1.5 text-sm text-pink-ink" role="alert">
            Those don&rsquo;t match yet.
          </p>
        )}
      </div>

      <Turnstile resetSignal={state} />

      {state.status === "error" && <FormError>{state.message}</FormError>}

      <SubmitButton pending="Creating…">Create account</SubmitButton>
    </form>
  );
}
