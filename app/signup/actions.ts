"use server";

import { headers } from "next/headers";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { validateUsername, usernameErrorMessage } from "@/lib/username";

export type SignUpState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | {
      status: "error";
      message: string;
      field?: "username" | "email" | "password" | "confirm_password";
    };

export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  const captchaToken = String(formData.get("captcha_token") ?? "");

  const usernameError = validateUsername(username);
  if (usernameError) {
    return { status: "error", message: usernameErrorMessage(usernameError), field: "username" };
  }
  if (!email) {
    return { status: "error", message: "Enter your email address.", field: "email" };
  }
  if (password.length < 8) {
    return {
      status: "error",
      message: "Use at least 8 characters.",
      field: "password",
    };
  }
  // Re-checked here as well as in the form: the browser check is a convenience,
  // and a Server Action is its own entry point that can be called directly.
  if (password !== confirmPassword) {
    return {
      status: "error",
      message: "Those passwords don't match.",
      field: "confirm_password",
    };
  }

  // Check the handle before creating the account. RLS hides other people's
  // profiles from an anonymous caller, and public_profiles only lists profiles
  // that opted to be public — so neither can answer "is this taken?". This runs
  // server-side with the service key purely to read one column.
  //
  // A collision between this check and the insert is still possible; the UNIQUE
  // constraint catches it, and the trigger's failure rolls back the auth user
  // rather than leaving an orphan.
  const admin = createServiceClient();
  const { data: taken, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (lookupError) {
    return { status: "error", message: "Couldn't check that handle. Try again." };
  }
  if (taken) {
    return { status: "error", message: "That handle is taken.", field: "username" };
  }

  const origin = (await headers()).get("origin") ?? "https://xlresale.com";
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by handle_new_user() to fill the profile row.
      data: { username, display_name: username },
      emailRedirectTo: `${origin}/auth/callback?next=/account`,
      captchaToken,
    },
  });

  if (error) {
    // Supabase reports a duplicate handle as a generic database error, because
    // the failure happens inside the trigger.
    if (/captcha/i.test(error.message)) {
      return { status: "error", message: "That verification expired. Try again." };
    }
    if (/Database error/i.test(error.message)) {
      return { status: "error", message: "That handle was just taken. Try another.", field: "username" };
    }
    return { status: "error", message: error.message };
  }

  return { status: "sent", email };
}
