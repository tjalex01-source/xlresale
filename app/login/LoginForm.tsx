"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, FormError, PasswordField, SubmitButton } from "@/components/form";
import { Turnstile } from "@/components/Turnstile";
import { signIn, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(signIn, { status: "idle" });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <Field
        label="Email address"
        name="email"
        type="email"
        required
        autoComplete="email"
        autoFocus
        placeholder="you@example.com"
      />

      <div>
        <PasswordField label="Password" name="password" required autoComplete="current-password" />
        <p className="mt-2 text-sm">
          <Link
            href="/forgot-password"
            className="font-semibold text-ink underline underline-offset-4 hover:text-pink"
          >
            Forgot your password?
          </Link>
        </p>
      </div>

      <Turnstile resetSignal={state} />

      {state.status === "error" && <FormError>{state.message}</FormError>}

      <SubmitButton pending="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
