import { FOCUS_OPTIONS, type ProfileFocus } from "@/lib/focus";

/**
 * The three buttons: Shopping · Selling · Both.
 *
 * One component for both places the question is asked — the first-run chooser
 * at `/welcome` and the small control on the account page — so the wording and
 * the order can't drift apart between them.
 *
 * Plain submit buttons in a plain form, no client JavaScript: three taps' worth
 * of state does not need a hydrated island, and this way it works on the first
 * paint of a cold phone.
 */

/** Selling borrows the tangerine of the landing page's "$5 puts your driveway
 *  on the map" block, so the two read as the same door. */
const TINT: Record<ProfileFocus, { bg: string; ink: string }> = {
  shopping: { bg: "var(--color-pink-50)", ink: "var(--color-pink-ink)" },
  selling: { bg: "var(--color-tangerine-50)", ink: "var(--color-tangerine-ink)" },
  both: { bg: "var(--color-violet-50)", ink: "var(--color-violet-ink)" },
};

export function FocusChooser({
  action,
  current = null,
  variant = "full",
}: {
  action: (formData: FormData) => Promise<void>;
  current?: ProfileFocus | null;
  variant?: "full" | "compact";
}) {
  if (variant === "compact") {
    return (
      <form action={action} className="mt-4 flex flex-wrap gap-2">
        {FOCUS_OPTIONS.map((option) => {
          const on = current === option.value;
          return (
            <button
              key={option.value}
              type="submit"
              name="focus"
              value={option.value}
              aria-current={on ? "true" : undefined}
              className={`inline-flex min-h-11 items-center rounded-[10px] px-4 text-sm font-semibold ${
                on
                  ? "bg-ink text-canvas"
                  : "border border-hair hover:border-pink hover:text-pink"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </form>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {FOCUS_OPTIONS.map((option) => {
        const tint = TINT[option.value];
        return (
          <button
            key={option.value}
            type="submit"
            name="focus"
            value={option.value}
            style={{ backgroundColor: tint.bg }}
            className="flex w-full items-center gap-4 rounded-[22px] px-6 py-5 text-left shadow-card transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="min-w-0 flex-1">
              <span
                className="block font-display text-[1.35rem] font-bold leading-tight"
                style={{ color: tint.ink }}
              >
                {option.label}
              </span>
              <span className="mt-1 block text-sm text-ink-soft">{option.blurb}</span>
            </span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="size-6 shrink-0"
              fill="none"
              stroke={tint.ink}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        );
      })}
    </form>
  );
}
