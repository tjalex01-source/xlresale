"use client";

import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { FINDS_BUCKET, findPhotoUrl } from "@/lib/finds";

const MAX_BYTES = 8 * 1024 * 1024;

/** Does this browser actually decode the file? Resolves rather than throws. */
function decodable(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new Image();
    const done = (ok: boolean) => {
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    probe.onload = () => done(probe.naturalWidth > 0);
    probe.onerror = () => done(false);
    probe.src = url;
  });
}

/**
 * One photo on a find, uploaded straight from the browser to Storage.
 *
 * It does NOT go through the Server Action. A Server Action body is capped at
 * 1MB by default and a photo off a phone is several times that, so the file
 * goes to Storage first and the form posts back only the path it landed at.
 * That also means the upload can't be what makes "Log it" feel slow.
 *
 * The path is `<finder_id>/<random>.<ext>`, built here rather than taken from
 * the file name: the storage policy checks only the first segment, so a name
 * like `../../someone-else/x.jpg` is exactly the thing not to trust.
 *
 * The trade this makes: pick a photo, then close the tab, and the object is
 * left with no row pointing at it. Choosing a different photo cleans up the one
 * before it, so the leak is bounded to abandoned drafts — worth it to keep the
 * submit fast and under the body limit.
 */
export function FindPhotoField({
  finderId,
  name = "photo_path",
  initial = null,
  /** Bumping this clears the field — the add form resets after a successful log. */
  resetKey,
}: {
  finderId: string;
  name?: string;
  initial?: string | null;
  resetKey?: unknown;
}) {
  const [path, setPath] = useState<string | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cleared by the parent after a submit, without remounting the whole form.
  const [seenReset, setSeenReset] = useState(resetKey);
  if (resetKey !== seenReset) {
    setSeenReset(resetKey);
    setPath(initial);
    setError(null);
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Photos only.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That photo is over 8MB.");
      return;
    }

    // Refuse anything this browser can't draw. A file that won't decode here
    // won't decode on the find's page or in the share card either, and the
    // alternative is a find that quietly carries a photo nobody can see — the
    // share card has its own fallback, but a broken image on the page itself
    // has none. Catches corrupt files, and HEIC on the browsers that can't
    // read it.
    if (!(await decodable(file))) {
      setError("That file didn't open as a photo. Try a JPEG or PNG.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const previous = path;

    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const next = `${finderId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(FINDS_BUCKET)
        .upload(next, file, { contentType: file.type, upsert: false });

      if (upErr) {
        setError(upErr.message);
        return;
      }

      setPath(next);
      // Only once the replacement is safely up.
      if (previous) await supabase.storage.from(FINDS_BUCKET).remove([previous]);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    const previous = path;
    setPath(null);
    if (inputRef.current) inputRef.current.value = "";
    if (previous) await createClient().storage.from(FINDS_BUCKET).remove([previous]);
  }

  return (
    <div>
      {path && <input type="hidden" name={name} value={path} />}

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border border-hair bg-panel px-4 text-sm font-semibold hover:border-pink hover:text-pink">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {busy ? "Uploading…" : path ? "Change photo" : "Add a photo"}
        </label>

        {path && (
          <button
            type="button"
            onClick={() => void clear()}
            className="min-h-11 rounded-[10px] px-3 text-sm font-semibold text-muted hover:text-pink"
          >
            Remove
          </button>
        )}
      </div>

      {path && (
        // eslint-disable-next-line @next/next/no-img-element -- user upload, arbitrary dimensions
        <img
          src={findPhotoUrl(path)}
          alt=""
          className="mt-3 aspect-square w-32 rounded-[14px] object-cover"
        />
      )}

      {error && (
        <p className="mt-2 rounded-[10px] bg-pink-50 px-3.5 py-2.5 text-sm text-pink-ink" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
