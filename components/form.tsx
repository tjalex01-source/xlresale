"use client";

import { useFormStatus } from "react-dom";

/** Shared form furniture for the account screens, styled from DESIGN.md. */

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
