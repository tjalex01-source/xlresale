import type { Metadata } from "next";

import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { SaleRow, type AdminSale } from "./SaleRow";

export const metadata: Metadata = { title: "Sales — Admin" };

/**
 * A filter chip. Declared at module scope, not inside the page: a component
 * created during render is a brand-new type every pass, so React throws its
 * state away each time.
 */
function Chip({
  base,
  value,
  label,
  active,
}: {
  base: string;
  value: string;
  label: string;
  active: boolean;
}) {
  return (
    <a
      href={value ? `${base}?filter=${value}` : base}
      className={`inline-flex min-h-11 items-center rounded-[10px] border px-4 text-sm font-bold ${
        active ? "border-pink bg-pink-50 text-pink-ink" : "border-hair bg-panel hover:border-pink"
      }`}
    >
      {label}
    </a>
  );
}

export default async function AdminSales({ searchParams }: PageProps<"/admin/sales">) {
  await requireAdmin();
  const params = await searchParams;

  const query = String(params.q ?? "").trim().toLowerCase();
  const filter = String(params.filter ?? "");

  const admin = createServiceClient();

  const [{ data: sales }, { data: profiles }, { data: watchers }] = await Promise.all([
    admin
      .from("sales")
      .select("id, title, address, sale_date, status, listing_paid, hidden_at, host_id")
      .order("sale_date", { ascending: false })
      .limit(500),
    admin.from("profiles").select("id, username"),
    admin.from("sale_watchers").select("sale_id"),
  ]);

  const handleById = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  // Counted in one pass rather than a count query per sale.
  const watcherCounts = new Map<string, number>();
  for (const w of watchers ?? []) {
    watcherCounts.set(w.sale_id, (watcherCounts.get(w.sale_id) ?? 0) + 1);
  }

  let rows: AdminSale[] = (sales ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    address: s.address,
    saleDate: s.sale_date,
    status: s.status,
    // "On the map" now means paid AND not hidden.
    published: s.listing_paid && s.hidden_at === null,
    listingPaid: s.listing_paid,
    hostHandle: handleById.get(s.host_id) ?? null,
    hostId: s.host_id,
    watcherCount: watcherCounts.get(s.id) ?? 0,
  }));

  if (query) {
    rows = rows.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.address.toLowerCase().includes(query) ||
        s.hostHandle?.toLowerCase().includes(query),
    );
  }
  if (filter === "live") rows = rows.filter((s) => s.published);
  if (filter === "draft") rows = rows.filter((s) => !s.published);

  const draftCount = (sales ?? []).filter((s) => !s.listing_paid || s.hidden_at !== null).length;

  return (
    <>
      <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
        Sales
      </h1>
      <p className="mt-3 text-ink-soft">
        {sales?.length ?? 0} total, {draftCount} not on the map. Taking a sale off the map hides it
        everywhere without destroying anything.
      </p>

      <form className="mt-6" action="/admin/sales">
        <label htmlFor="q" className="block text-sm font-semibold">
          Search
        </label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="title, address, or host handle"
            className="min-w-56 flex-1 rounded-[10px] border border-hair bg-panel px-3.5 py-2.5 text-base outline-none focus:border-pink"
          />
          <button
            type="submit"
            className="min-h-11 rounded-[10px] bg-ink px-4 text-sm font-semibold text-canvas hover:opacity-90"
          >
            Search
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip base="/admin/sales" value="" label="All" active={filter === ""} />
        <Chip base="/admin/sales" value="live" label="On the map" active={filter === "live"} />
        <Chip
          base="/admin/sales"
          value="draft"
          label={`Drafts (${draftCount})`}
          active={filter === "draft"}
        />
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-[14px] border border-hair bg-panel px-4 py-6 text-center text-sm text-ink-soft">
          Nothing matches.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((sale) => (
            <SaleRow key={sale.id} sale={sale} />
          ))}
        </ul>
      )}
    </>
  );
}
