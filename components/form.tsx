"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";

/** Shared form furniture for the account screens, styled from DESIGN.md. */

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-5">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      {off && (
        <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

/**
 * A password box with a reveal toggle.
 *
 * The toggle is a real <button type="button"> — inside a form, a bare <button>
 * defaults to submit, so tapping the eye would try to create the account.
 * It's excluded from the tab order because it sits between the password and the
 * next field, and keyboard users hitting Tab expect to move on, not to land on
 * an icon. It stays reachable by pointer and by screen readers.
 */
export function PasswordField({
  label,
  name,
  hint,
  invalid,
  ...rest
}: {
  label: string;
  name: string;
  hint?: string;
  invalid?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type">) {
  const [shown, setShown] = useState(false);
  const hintId = useId();

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold">
        {label}
      </label>
      <div
        className={`mt-1.5 flex items-center rounded-[10px] border bg-panel focus-within:border-pink ${
          invalid ? "border-pink" : "border-hair"
        }`}
      >
        <input
          id={name}
          name={name}
          type={shown ? "text" : "password"}
          aria-describedby={hint ? hintId : undefined}
          aria-invalid={invalid || undefined}
          className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-base outline-none placeholder:text-grey"
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
          className="mr-1 grid size-11 shrink-0 place-items-center rounded-[10px] text-muted hover:text-ink"
        >
          <EyeIcon off={shown} />
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  hint,
  prefix,
  invalid,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  hint?: string;
  /** Static text shown inside the control, e.g. the "@" on a handle. */
  prefix?: string;
  invalid?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type">) {
  const hintId = hint ? `${name}-hint` : undefined;

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold">
        {label}
      </label>
      <div
        className={`mt-1.5 flex items-center rounded-[10px] border bg-panel focus-within:border-pink ${
          invalid ? "border-pink" : "border-hair"
        }`}
      >
        {prefix && (
          <span aria-hidden className="pl-3.5 font-mono text-base text-muted">
            {prefix}
          </span>
        )}
        <input
          id={name}
          name={name}
          type={type}
          aria-describedby={hintId}
          aria-invalid={invalid || undefined}
          className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-base outline-none placeholder:text-grey"
          {...rest}
        />
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, pending }: { children: React.ReactNode; pending?: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-[10px] bg-pink px-4 py-3 font-display text-xl font-bold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:hover:translate-y-0"
    >
      {busy && pending ? pending : children}
    </button>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[10px] bg-pink-50 px-3.5 py-2.5 text-sm text-pink-ink" role="alert">
      {children}
    </p>
  );
}

export function CheckYourEmail({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[16px] border border-green/30 bg-green-50 p-5"
      role="status"
      aria-live="polite"
    >
      <h2 className="font-display text-lg font-bold">Check your email</h2>
      <p className="mt-1.5 text-sm">
        Sent to <span className="font-mono text-[13px]">{email}</span>.
      </p>
      <p className="mt-3 text-sm text-ink-soft">{children}</p>
    </div>
  );
}
