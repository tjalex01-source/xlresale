"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormError } from "@/components/form";
import { deleteMyAccount, type DeleteState } from "./actions";

/**
 * Its own submit button rather than the shared one — that button is pink and
 * reads as "yes, do the nice thing". This action is irreversible and should
 * look like it.
 */
function DeleteButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-4 inline-flex min-h-11 items-center rounded-[10px] bg-pink px-5 text-sm font-bold text-white disabled:opacity-40"
    >
      {pending ? "Deleting…" : "Delete my account for good"}
    </button>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState<DeleteState | null, FormData>(deleteMyAccount, null);

  return (
    <form action={action}>
      <label htmlFor="confirm" className="block text-sm font-semibold">
        Type <span className="font-mono">delete</span> to confirm
      </label>
      <input
        id="confirm"
        name="confirm"
        autoComplete="off"
        placeholder="delete"
        className="mt-1.5 w-48 rounded-[10px] border border-hair bg-canvas px-3.5 py-2.5 font-mono text-base outline-none focus:border-pink"
      />

      <DeleteButton disabled={false} />

      {state?.status === "error" && (
        <div className="mt-4">
          <FormError>{state.message}</FormError>
        </div>
      )}
    </form>
  );
}
