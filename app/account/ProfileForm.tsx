"use client";

import { useActionState, useState } from "react";

import { Field, FormError, SubmitButton } from "@/components/form";
import { saveProfile, type SaveResult } from "./actions";

export function ProfileForm({
  displayName,
  bio,
  isPublic,
}: {
  displayName: string;
  bio: string;
  isPublic: boolean;
}) {
  const [result, action] = useActionState<SaveResult | null, FormData>(saveProfile, null);
  const [name, setName] = useState(displayName);
  const [text, setText] = useState(bio);
  const [publicProfile, setPublicProfile] = useState(isPublic);

  return (
    <form action={action} className="mt-4 space-y-4">
      <Field
        label="Your name"
        name="display_name"
        required
        maxLength={60}
        hint="Shown to shoppers on the sales you host."
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div>
        <label htmlFor="bio" className="block text-sm font-semibold">
          Bio <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={280}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Saturday regular. Tools, vinyl, anything with a cord."
          className="mt-1.5 w-full rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 text-base outline-none placeholder:text-grey focus:border-pink"
        />
        <p className="mt-1.5 font-mono text-[13px] text-muted">{text.length}/280</p>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="is_public"
          checked={publicProfile}
          onChange={(e) => setPublicProfile(e.target.checked)}
          className="mt-1 size-5 accent-[var(--color-green)]"
        />
        <span>
          <span className="font-semibold">Show my profile publicly</span>
          <span className="mt-0.5 block text-sm text-ink-soft">
            Your handle, bio and the finds you mark public. Never your address.
          </span>
        </span>
      </label>

      <div>
        <SubmitButton pending="Saving…">Save profile</SubmitButton>
      </div>

      {result?.ok === false && <FormError>{result.message}</FormError>}
      {result?.ok === true && (
        <p className="text-sm text-green-ink" role="status">
          {result.message}
        </p>
      )}
    </form>
  );
}
