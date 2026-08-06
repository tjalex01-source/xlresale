import { createClient } from "@/lib/supabase/server";
import { SALE_STATUS_META, SALE_STATUS_ORDER } from "@/lib/sale-status";

/**
 * Phase 0 scaffold check. This is not the product — it exists to prove the
 * fonts, the palette, and the Supabase connection are actually wired before
 * Phase 1 starts. The real shell replaces it.
 */
async function checkDatabase(): Promise<{ ok: boolean; detail: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, detail: "no Supabase keys in .env.local yet" };
  }

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("categories")
      .select("*", { count: "exact", head: true });

    if (error) return { ok: false, detail: error.message };
    return { ok: true, detail: `${count ?? 0} categories seeded` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "unknown error" };
  }
}

export default async function Home() {
  const db = await checkDatabase();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-sale">
        Phase 0 · scaffold
      </p>
      <h1 className="mt-2 font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] sm:text-5xl">
        XLResale
      </h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        Garage, yard, and estate sales — see which ones are open right now, and plan a
        route that reaches them before they close.
      </p>

      <section className="mt-10 rounded-2xl border border-hair bg-panel p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">Pin states</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The <code className="font-mono text-[13px]">sale_status</code> lifecycle both
          sides read.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {SALE_STATUS_ORDER.map((status) => {
            const meta = SALE_STATUS_META[status];
            return (
              <li
                key={status}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium"
                style={{ backgroundColor: meta.tint, color: meta.color }}
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                {meta.label}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-4 rounded-2xl border border-hair bg-panel p-5 shadow-card">
        <h2 className="font-display text-lg font-bold">Connection</h2>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: db.ok ? "var(--color-live)" : "var(--color-asphalt)" }}
          />
          <span className="font-medium">{db.ok ? "Supabase reachable" : "Not connected"}</span>
          <span className="font-mono text-[13px] text-ink-soft">{db.detail}</span>
        </p>
      </section>

      <p className="mt-8 font-mono text-[13px] text-asphalt">
        Next: Phase 1 — magic-link auth and profiles.
      </p>
    </main>
  );
}
