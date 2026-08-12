import { SALE_STATUS_META } from "@/lib/sale-status";
import type { SaleStatus } from "@/lib/database.types";

/**
 * The tag pin, as a data-URI SVG for a Google Maps marker.
 *
 * Same silhouette as <TagPin> — a price tag on a stake with a hole punch, never
 * Google's red teardrop (DESIGN.md → Signature elements). It has to be built as
 * a string rather than reused as a React component because a marker icon is an
 * image URL, not a DOM node.
 *
 * The live pin's pulsing halo is drawn as a SMIL <animate> inside the SVG. CSS
 * animations don't run in an SVG loaded as an image, but SMIL does, so this is
 * the one way to get the halo without a Map ID and Advanced Markers.
 */
export function tagPinDataUri(status: SaleStatus, selected = false): string {
  const { hex, pulse } = SALE_STATUS_META[status];
  const stroke = selected ? `stroke="#17131f" stroke-width="2.5"` : "";

  const halo = pulse
    ? `<circle cx="20" cy="20" r="6" fill="${hex}" opacity="0.45">
         <animate attributeName="r" values="6;19;6" dur="2.2s" repeatCount="indefinite"/>
         <animate attributeName="opacity" values="0.45;0;0.45" dur="2.2s" repeatCount="indefinite"/>
       </circle>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="40" height="52">
  ${halo}
  <path d="M6 3h28a5 5 0 0 1 5 5v24a5 5 0 0 1-5 5h-8.5L20 49l-5.5-12H6a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5z" fill="${hex}" ${stroke}/>
  <circle cx="12" cy="13" r="3.4" fill="#fffdf9" opacity="0.9"/>
</svg>`;

  // encodeURIComponent rather than base64: it keeps the markup readable in
  // devtools and avoids the btoa unicode trap entirely.
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
