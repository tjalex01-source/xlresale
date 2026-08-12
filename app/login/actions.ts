"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" } | { status: "error"; message: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rawNext = String(formData.get("next") ?? "/account");
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/account";

  if (!email || !password) {
    return { status: "error", message: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase says "Email not confirmed" for an unverified account; everything
    // else collapses to invalid credentials on purpose, so this can't be used to
    // discover which addresses have accounts.
    if (/not confirmed/i.test(error.message)) {
      return {
        status: "error",
        message: "Confirm your email first — check your inbox for the link we sent.",
      };
    }
    return { status: "error", message: "That email and password don't match." };
  }

  redirect(next);
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
  if (!email) return { status: "error", message: "Enter your email address." };

  const origin = (await headers()).get("origin") ?? "https://xlresale.com";
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/account/password`,
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
