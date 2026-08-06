"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "sending" });

    const supabase = createClient();
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect.toString() },
    });

    if (error) {
      setState({ kind: "error", message: error.message });
      return;
    }
    setState({ kind: "sent" });
  }

  if (state.kind === "sent") {
    return (
      <div
        className="rounded-2xl border border-live/30 bg-live-tint p-5"
        role="status"
        aria-live="polite"
      >
        <h2 className="font-display text-lg font-bold">Check your email</h2>
        <p className="mt-1.5 text-sm">
          We sent a sign-in link to <span className="font-mono text-[13px]">{email}</span>. It
          expires in an hour.
        </p>
        <p className="mt-3 text-sm text-ink-soft">
          Open it on this device — the link is tied to this browser.
        </p>
        <button
          type="button"
          onClick={() => setState({ kind: "idle" })}
          className="mt-4 text-sm font-semibold text-ink underline underline-offset-4 hover:text-sale"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-semibold">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1.5 w-full rounded-xl border border-hair bg-panel px-3.5 py-2.5 text-base outline-none placeholder:text-asphalt focus:border-sale"
        />
      </div>

      {state.kind === "error" && (
        <p className="rounded-xl bg-sale-tint px-3.5 py-2.5 text-sm text-sale-deep" role="alert">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={state.kind === "sending"}
        className="w-full rounded-xl bg-sale px-4 py-3 font-display text-xl font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {state.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>

      <p className="text-sm text-ink-soft">
        No password to remember. We email you a link that signs you straight in.
      </p>
    </form>
  );
}
