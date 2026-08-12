"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Field, FormError, SubmitButton } from "@/components/form";
import { USERNAME_HINT } from "@/lib/username";
import { saveUsername, type SaveResult } from "./actions";

export function HandleForm({ initial }: { initial: string | null }) {
  const [result, action] = useActionState<SaveResult | null, FormData>(saveUsername, null);
  const [username, setUsername] = useState(initial ?? "");

  return (
    <div>
      {initial ? (
        <p className="mt-2 text-sm text-ink-soft">
          Your handle is <span className="font-mono text-[13px] text-ink">@{initial}</span> —{" "}
          <Link
            href={`/u/${initial}`}
            className="font-semibold text-ink underline underline-offset-4 hover:text-pink"
          >
            view your profile
          </Link>
        </p>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">
          Pick one and you get a public profile at xlresale.com/u/…
        </p>
      )}

      <form action={action} className="mt-4">
        <Field
          label={initial ? "Change your handle" : "Choose your handle"}
          name="username"
          prefix="@"
          required
          maxLength={20}
          autoCapitalize="none"
          spellCheck={false}
          placeholder="saturdayhunter"
          hint={initial ? "Changing it breaks any link you've already shared." : USERNAME_HINT}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          invalid={result?.ok === false}
        />

        <div className="mt-3">
          <SubmitButton pending="Saving…">{initial ? "Update handle" : "Claim handle"}</SubmitButton>
        </div>

        {result?.ok === false && (
          <div className="mt-3">
            <FormError>{result.message}</FormError>
          </div>
        )}
        {result?.ok === true && (
          <p className="mt-3 text-sm text-green-ink" role="status">
            {result.message}
          </p>
        )}
      </form>
    </div>
  );
}
