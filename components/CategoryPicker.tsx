"use client";

import { useMemo, useState } from "react";

export interface PickerCategory {
  id: number;
  label: string;
  color: string;
  parent_id: number | null;
  position: number;
}

/**
 * The category picker, shared by hosts tagging a sale and shoppers saying what
 * they're after — deliberately the same control, because they're answering the
 * same question from opposite sides.
 *
 * Parents are tappable on their own: a host who ticks "Electronics" and stops
 * has given a complete answer. Children are extra precision for people who want
 * it, revealed only when a parent is opened, so the default view stays a
 * readable grid rather than eighty checkboxes.
 *
 * Styled as DESIGN.md's peel-off sticker chips — each sits at a slight angle
 * with a soft shadow and straightens when you touch it. The colour comes from
 * the category row; children inherit their parent's.
 */
export function CategoryPicker({
  categories,
  name = "category_ids",
  initial = [],
}: {
  categories: PickerCategory[];
  /** Form field name; one hidden input is emitted per selected id. */
  name?: string;
  initial?: number[];
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(initial));
  const [open, setOpen] = useState<Set<number>>(
    // Anything with a child already chosen starts open, or those picks would be
    // invisible until you happened to expand the right parent.
    () => {
      const parentsOfChosen = new Set<number>();
      for (const c of categories) {
        if (c.parent_id && initial.includes(c.id)) parentsOfChosen.add(c.parent_id);
      }
      return parentsOfChosen;
    },
  );

  const parents = useMemo(
    () => categories.filter((c) => c.parent_id === null).sort((a, b) => a.position - b.position),
    [categories],
  );
  const childrenOf = useMemo(() => {
    const map = new Map<number, PickerCategory[]>();
    for (const c of categories) {
      if (c.parent_id === null) continue;
      const list = map.get(c.parent_id) ?? [];
      list.push(c);
      map.set(c.parent_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [categories]);

  const toggle = (id: number, hasChildren: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        if (hasChildren) setOpen((o) => new Set(o).add(id));
      }
      return next;
    });
  };

  const countChosenIn = (parentId: number) =>
    (childrenOf.get(parentId) ?? []).filter((c) => selected.has(c.id)).length;

  return (
    <div>
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <div className="grid gap-2 sm:grid-cols-2">
        {parents.map((parent, i) => {
          const kids = childrenOf.get(parent.id) ?? [];
          const on = selected.has(parent.id);
          const chosenKids = countChosenIn(parent.id);
          const expanded = open.has(parent.id);

          return (
            <div key={parent.id}>
              <div className="flex items-stretch gap-1">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(parent.id, kids.length > 0)}
                  // Alternating tilt so a grid of stickers doesn't look like a
                  // grid of buttons; it straightens on interaction.
                  style={{
                    borderColor: on ? parent.color : undefined,
                    backgroundColor: on ? `${parent.color}1f` : undefined,
                    rotate: on ? "0deg" : i % 2 ? "-0.5deg" : "0.6deg",
                  }}
                  className="flex min-h-12 flex-1 items-center gap-2.5 rounded-[12px] border border-hair bg-panel px-3.5 text-left text-sm font-bold shadow-card transition-[rotate,background-color] hover:rotate-0"
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: parent.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{parent.label}</span>
                  {chosenKids > 0 && (
                    <span className="font-mono text-xs text-muted">+{chosenKids}</span>
                  )}
                </button>

                {kids.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Hide" : "Show"} ${parent.label} options`}
                    onClick={() =>
                      setOpen((o) => {
                        const next = new Set(o);
                        if (next.has(parent.id)) next.delete(parent.id);
                        else next.add(parent.id);
                        return next;
                      })
                    }
                    className="grid w-11 shrink-0 place-items-center rounded-[12px] border border-hair bg-panel text-muted hover:text-ink"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden
                      className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                )}
              </div>

              {expanded && kids.length > 0 && (
                <div className="mb-1 ml-3 mt-1.5 flex flex-wrap gap-1.5 border-l border-hair pl-3">
                  {kids.map((kid) => {
                    const kidOn = selected.has(kid.id);
                    return (
                      <button
                        key={kid.id}
                        type="button"
                        aria-pressed={kidOn}
                        onClick={() => toggle(kid.id, false)}
                        style={{
                          borderColor: kidOn ? parent.color : undefined,
                          backgroundColor: kidOn ? `${parent.color}1f` : undefined,
                        }}
                        className="inline-flex min-h-9 items-center rounded-full border border-hair bg-panel px-3 text-[13px] font-semibold"
                      >
                        {kid.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
