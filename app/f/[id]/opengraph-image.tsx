import { ImageResponse } from "next/og";

import { createClient } from "@/lib/supabase/server";
import { findPhotoUrl, formatDollars, savedAmount, siteUrl } from "@/lib/finds";

/**
 * The card that renders in someone else's chat app.
 *
 * This is the actual product of the growth loop — the link gets pasted into a
 * group chat and what people see is this image, not the page. So it carries the
 * one thing worth looking at: the photo, and the two numbers.
 *
 * Two layouts. With a photo, the photo takes half the card and the numbers sit
 * beside it. Without one, the card goes to a solid tangerine block with Nub in
 * it, because a share card that is mostly empty white reads as a broken link.
 */

export const alt = "A find on XLResale";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Assets this card needs, fetched once per warm instance.
 *
 * Over HTTP from our own origin, not `fetch(new URL(…, import.meta.url))`:
 * Turbopack answers a file: URL with "not implemented... yet...", so the
 * pattern the Next docs give for local assets doesn't survive `next dev`. One
 * mechanism for the font and the mascot, working in both dev and production,
 * beats two that each work somewhere.
 */
const assets = new Map<string, Promise<ArrayBuffer | null>>();

async function asset(path: string): Promise<ArrayBuffer | null> {
  let pending = assets.get(path);
  if (!pending) {
    pending = fetch(`${siteUrl()}${path}`)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
    assets.set(path, pending);
  }

  // A copy per call, never the cached buffer itself. A warm instance serves
  // many requests from this map, and anything downstream that transfers or
  // detaches an ArrayBuffer would leave every later render holding zero bytes —
  // which surfaces as "unsupported image format" on request two and looks
  // nothing like a caching bug.
  const data = await pending;
  return data ? data.slice(0) : null;
}

const INK = "#17131F";
const CANVAS = "#FFFDF9";
const PINK = "#FF2E63";
const TANGERINE = "#FF9F1C";
const GREY = "#6B6478";
const GREEN_50 = "#DEF7EC";
const GREEN_INK = "#04703F";

type Fonts = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"];

/**
 * Render to actual PNG bytes.
 *
 * An ImageResponse is a lazy stream: satori and resvg do their work while the
 * body is piped, so a decode failure surfaces *after* the Response has been
 * constructed and handed back. Buffering it here is what makes the fallback
 * below possible at all — a try/catch around `new ImageResponse(...)` catches
 * nothing.
 */
async function toPng(element: React.ReactElement, fonts: Fonts): Promise<Response> {
  const response = new ImageResponse(element, { ...size, fonts });
  const bytes = await response.arrayBuffer();
  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      // Same caching Next gives a generated OG image, kept because this hand-rolled
      // Response replaces the one that would have carried it.
      "Cache-Control": "public, immutable, no-transform, max-age=31536000",
    },
  });
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS returns nothing for a private find, so this renders the generic card
  // rather than leaking a title through an image somebody hotlinked.
  const { data: find } = await supabase
    .from("finds")
    .select("title, price_paid, est_value, photo_path")
    .eq("id", id)
    .maybeSingle();

  // Both faces of the pairing, because DESIGN.md's type rule is the identity:
  // Bricolage for the display line, Space Mono for every number. Setting the
  // title in mono because it happened to be the font already loaded is exactly
  // the drift that rule exists to stop.
  //
  // No font is still a card — satori falls back to its own face rather than
  // failing, and a card in the wrong typeface beats a broken image.
  const [mono, display] = await Promise.all([
    asset("/fonts/SpaceMono-Bold.ttf"),
    asset("/fonts/Bricolage-ExtraBold.ttf"),
  ]);
  const fonts = [
    mono && { name: "Space Mono", data: mono, style: "normal" as const, weight: 700 as const },
    display && {
      name: "Bricolage",
      data: display,
      style: "normal" as const,
      weight: 800 as const,
    },
  ].filter((f) => f !== null && f !== undefined);

  if (!find) return toPng(<Fallback />, fonts);

  /**
   * Try the photo, fall back to Nub.
   *
   * The renderer decodes the photo itself and throws on anything it doesn't
   * understand. That isn't hypothetical: the bucket accepts HEIC because that
   * is what an iPhone produces, and HEIC is exactly what resvg can't read. A
   * corrupt upload or a photo deleted after the fact does the same. Without
   * this the whole route 500s and the link previews as nothing — so a photo
   * that won't render costs the photo, not the card.
   */
  const photo = find.photo_path ? await loadPhoto(find.photo_path) : null;
  if (photo) return toPng(<Card find={find} photo={photo} />, fonts);

  return toPng(<Card find={find} nub={await loadNub()} />, fonts);
}

function Fallback() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: CANVAS,
        color: INK,
        fontFamily: "Bricolage",
        fontSize: 64,
      }}
    >
      XLResale
    </div>
  );
}

function Card({
  find,
  photo = null,
  nub = null,
}: {
  find: { title: string; price_paid: number | null; est_value: number | null };
  /** Data URI, already fetched and sniffed — see loadPhoto. */
  photo?: string | null;
  nub?: string | null;
}) {
  const saved = savedAmount(find);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: CANVAS }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- satori renders to PNG, not to a DOM
        <img
          src={photo}
          alt=""
          width={520}
          height={630}
          style={{ width: 520, height: 630, objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: 520,
            height: 630,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: TANGERINE,
          }}
        >
          {/* Short of the full height on purpose: at 630 his feet sat flush
              against the bottom edge and read as a crop. */}
          {nub && (
            // eslint-disable-next-line @next/next/no-img-element -- satori renders to PNG, not to a DOM
            <img src={nub} alt="" width={288} height={550} style={{ objectFit: "contain" }} />
          )}
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          fontFamily: "Space Mono",
          color: INK,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: PINK }}>A FIND</div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontFamily: "Bricolage",
              fontSize: find.title.length > 44 ? 52 : 66,
              lineHeight: 1.02,
              letterSpacing: -1.5,
            }}
          >
            {find.title.length > 90 ? `${find.title.slice(0, 88)}…` : find.title}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 36 }}>
            {find.price_paid !== null && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: GREY }}>
                  PAID
                </div>
                <div style={{ display: "flex", fontSize: 96, lineHeight: 1 }}>
                  {formatDollars(find.price_paid)}
                </div>
              </div>
            )}
            {find.est_value !== null && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: GREY }}>
                  WORTH
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 66,
                    lineHeight: 1,
                    color: GREY,
                    textDecoration: "line-through",
                  }}
                >
                  {formatDollars(find.est_value)}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 34 }}>
            <div style={{ display: "flex", fontSize: 30 }}>
              <span style={{ color: CANVAS, background: INK, padding: "6px 14px" }}>XL</span>
              <span style={{ color: PINK, background: INK, padding: "6px 14px 6px 0" }}>Resale</span>
            </div>
            {saved !== null && (
              <div
                style={{
                  display: "flex",
                  fontSize: 30,
                  color: GREEN_INK,
                  background: GREEN_50,
                  padding: "8px 20px",
                  borderRadius: 999,
                }}
              >
                {formatDollars(saved)} up
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Nub as a data URI, for the no-photo card.
 *
 * If the fetch fails the card renders as a plain tangerine block, which is
 * still a perfectly good card — nothing here is allowed to turn a missing
 * decoration into a broken image.
 */
async function loadNub(): Promise<string | null> {
  const data = await asset("/mascot/nub-grab.png");
  if (!data) return null;
  return `data:image/png;base64,${Buffer.from(data).toString("base64")}`;
}

/**
 * The mime type of an image the renderer can actually decode, or null.
 *
 * The bucket accepts HEIC, because that is what an iPhone hands over, and the
 * renderer cannot read it — it throws deep inside the response stream, where
 * the failure is not catchable from here: a try/catch around the render (even
 * one that awaits the bytes) still lets the request 500, and a 500 means the
 * link previews as nothing at all.
 *
 * So the decision is made before the renderer ever sees the file. Sniffing the
 * first bytes is also the only honest check — `Content-Type` is whatever the
 * uploader claimed.
 */
function imageMime(bytes: Uint8Array): string | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);

  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  // WebP is RIFF....WEBP
  if (starts(0x52, 0x49, 0x46, 0x46) && [0x57, 0x45, 0x42, 0x50].every((b, i) => bytes[8 + i] === b))
    return "image/webp";

  return null;
}

/**
 * The find's photo as a data URI, or null if it can't be used.
 *
 * Fetched here rather than left as a URL for the renderer to resolve, so a
 * photo that has since been deleted, or that arrived as HEIC, becomes the
 * mascot layout instead of a broken card.
 */
async function loadPhoto(storagePath: string): Promise<string | null> {
  try {
    const response = await fetch(findPhotoUrl(storagePath));
    if (!response.ok) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());

    // The mime comes from the bytes, not from the Content-Type header. The
    // header is whatever the uploader claimed, and a data: URI carrying the
    // wrong one is another way to hand the renderer something it won't read.
    const mime = imageMime(bytes);
    if (!mime) return null;

    return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}
