"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/safe-redirect";
import { DEFAULT_LANDING, landingFor } from "@/lib/focus";

export type LoginState = { status: "idle" } | { status: "error"; message: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const captchaToken = String(formData.get("captcha_token") ?? "");
  const rawNext = String(formData.get("next") ?? DEFAULT_LANDING);

  // Only an explicit destination survives. The form sends DEFAULT_LANDING when
  // nobody asked for anywhere, and that's the case the sign-in landing below
  // gets to answer — someone who clicked "List your sale" keeps their target.
  const requested = rawNext === DEFAULT_LANDING ? null : rawNext;

  if (!email || !password) {
    return { status: "error", message: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });

  if (error) {
    // Supabase says "Email not confirmed" for an unverified account; everything
    // else collapses to invalid credentials on purpose, so this can't be used to
    // discover which addresses have accounts.
    if (/captcha/i.test(error.message)) {
      return { status: "error", message: "That verification expired. Try again." };
    }
    if (/not confirmed/i.test(error.message)) {
      return {
        status: "error",
        message: "Confirm your email first — check your inbox for the link we sent.",
      };
    }
    return { status: "error", message: "That email and password don't match." };
  }

  // Where a plain sign-in goes is now the person's own answer to "what brings
  // you here?" — the map for a shopper, the seller dashboard for a host, and
  // the chooser itself for anyone who has never been asked. See lib/focus.ts.
  const { data: profile } = await supabase
    .from("profiles")
    .select("focus")
    .eq("id", data.user.id)
    .single();

  // Resolved against our own origin rather than string-tested. `next` arrives
  // from a query parameter, and redirect() takes a bare path straight into the
  // Location header: `/\evil.com` passes a startsWith("/") check and then the
  // browser resolves it to https://evil.com. safe-redirect.ts documents the
  // whole family. An open redirect on the sign-in page is the worst place for
  // one — the visitor has just proved the site is genuine by logging into it.
  const origin = (await headers()).get("origin") ?? "https://xlresale.com";
  redirect(safeRedirect(requested, origin, landingFor(profile?.focus ?? null)));
}

export type ResetState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export async function requestPasswordReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim();
  const captchaToken = String(formData.get("captcha_token") ?? "");
  if (!email) return { status: "error", message: "Enter your email address." };

  const origin = (await headers()).get("origin") ?? "https://xlresale.com";
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/account/password`,
    captchaToken,
  });

  // Deliberately reports success either way — a different response for unknown
  // addresses would let anyone test which emails have accounts.
  if (error && !/rate/i.test(error.message)) {
    return { status: "sent", email };
  }
  if (error) return { status: "error", message: "Too many attempts. Wait a minute and try again." };

  return { status: "sent", email };
}

export type PasswordState = { status: "idle" } | { status: "error"; message: string };

export async function updatePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  if (password.length < 8) return { status: "error", message: "Use at least 8 characters." };
  if (password !== confirmPassword) {
    return { status: "error", message: "Those passwords don't match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "That reset link expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", message: error.message };

  redirect("/account?updated=password");
}
