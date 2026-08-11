import { Nub } from "@/components/Nub";

/**
 * The shape every empty screen takes. DESIGN.md: "an empty screen is an
 * invitation to act" — so this always wants a heading that says what's missing
 * and, wherever there's something to do, an action. Nub carries the warmth so
 * the words can stay plain and useful.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <Nub pose="shrug" motion="float" width={190} decorative />
      <h3 className="mt-6 font-display text-xl font-bold">{title}</h3>
      {children && <p className="mt-2 max-w-sm text-ink-soft">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
