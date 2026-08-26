/**
 * What's at a sale, in the category's own colour.
 *
 * One component so a sale looks the same in a list, on its own page, and in a
 * shopper's alert — the colours are the fastest thing on the page to read, and
 * they only work as a signal if "tools pink, furniture tangerine" holds
 * everywhere. `categories.color` is the source; nothing here invents one.
 *
 * Body font, not mono. DESIGN.md reserves mono for prices, miles, minutes and
 * clock times — a label set in it reads as data and steals emphasis from the
 * numbers that are.
 */

export interface ChipCategory {
  id: number;
  label: string;
  color: string;
}

export function CategoryChips({
  categories,
  /** Beyond this many, the rest collapse into "+N". Lists get cluttered fast. */
  max,
  className = "",
}: {
  categories: ChipCategory[];
  max?: number;
  className?: string;
}) {
  if (categories.length === 0) return null;

  const shown = max ? categories.slice(0, max) : categories;
  const hidden = categories.length - shown.length;

  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {shown.map((c) => (
        <li
          key={c.id}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[13px] font-semibold"
          // 1f is ~12% alpha — enough tint to read as a chip, light enough to
          // keep ink on it above 4.5:1 for every colour in the palette.
          style={{ backgroundColor: `${c.color}1f` }}
        >
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
          {c.label}
        </li>
      ))}
      {hidden > 0 && (
        <li className="inline-flex items-center px-1 font-mono text-[13px] text-muted">+{hidden}</li>
      )}
    </ul>
  );
}
