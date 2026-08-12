"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Photo = { id: string; storage_path: string };

const MAX_PHOTOS = 12;
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Uploads sale photos straight from the browser to Supabase Storage.
 *
 * The path is always `<host_id>/<sale_id>/<random>.<ext>` because the storage
 * policy only lets an account write under its own id — the first segment is the
 * check. It's built here rather than taken from the file name, so a crafted name
 * can't escape the folder.
 */
export function SalePhotos({
  saleId,
  hostId,
  initial,
  publicBase,
}: {
  saleId: string;
  hostId: string;
  initial: Photo[];
  publicBase: string;
}) {
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setError(`That's the ${MAX_PHOTOS}-photo limit.`);
      return;
    }

    const chosen = Array.from(files).slice(0, room);
    setBusy(true);
    const supabase = createClient();

    try {
      for (const file of chosen) {
        if (!file.type.startsWith("image/")) {
          setError("Photos only.");
          continue;
        }
        if (file.size > MAX_BYTES) {
          setError(`${file.name} is over 8MB.`);
          continue;
        }

        const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${hostId}/${saleId}/${crypto.randomUUID()}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("sale-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          setError(upErr.message);
          continue;
        }

        const { data, error: rowErr } = await supabase
          .from("sale_photos")
          .insert({ sale_id: saleId, storage_path: path, position: photos.length })
          .select("id, storage_path")
          .single();

        if (rowErr || !data) {
          // The object exists but nothing points at it — clean up rather than
          // leave a file no one can find or delete.
          await supabase.storage.from("sale-photos").remove([path]);
          setError(rowErr?.message ?? "Couldn't save that photo.");
          continue;
        }
        setPhotos((p) => [...p, data]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo: Photo) {
    const supabase = createClient();
    setPhotos((p) => p.filter((x) => x.id !== photo.id));
    await supabase.from("sale_photos").delete().eq("id", photo.id);
    await supabase.storage.from("sale-photos").remove([photo.storage_path]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border border-hair bg-panel px-4 text-sm font-semibold hover:border-pink hover:text-pink">
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
          {busy ? "Uploading…" : "Add photos"}
        </label>
        <span className="font-mono text-[13px] text-muted">
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      {error && (
        <p className="mt-3 rounded-[10px] bg-pink-50 px-3.5 py-2.5 text-sm text-pink-ink" role="alert">
          {error}
        </p>
      )}

      {photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.id} className="group relative overflow-hidden rounded-[10px] bg-hair">
              {/* eslint-disable-next-line @next/next/no-img-element -- user uploads, arbitrary dimensions */}
              <img
                src={`${publicBase}/${photo.storage_path}`}
                alt=""
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(photo)}
                className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-ink/80 text-canvas opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Remove photo"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
