import type { Metadata } from "next";

import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/server";
import { UserRow, type AdminUser } from "./UserRow";

export const metadata: Metadata = { title: "Accounts — Admin" };

/**
 * Supabase records a ban as a `banned_until` timestamp, so a date in the past
 * means the suspension has already lapsed.
 *
 * Lives at module scope because reading the clock inside a component body makes
 * render non-idempotent — the rule holds even here, where the component runs
 * once per request on the server.
 */
function isBanned(bannedUntil: string | null | undefined): boolean {
  return Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now());
}

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

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  const { supabase, user: me } = await requireAdmin();
  const params = await searchParams;

  const query = String(params.q ?? "").trim().toLowerCase();
  const filter = String(params.filter ?? "");

  const admin = createServiceClient();

  // Two sources, because they live in different places: app activity comes from
  // the RPC (counts + the empty-account heuristic), while email, confirmation
  // and ban state live in auth.users, which has no RLS path at all.
  const [{ data: accounts }, authList, { data: adminRows }] = await Promise.all([
    // Deliberately the USER client, not the service client: admin_accounts()
    // gates on is_admin(), which reads auth.uid(), and the service role has no
    // auth.uid() — calling it privileged makes the gate reject its own console
    // and return zero rows. The function is SECURITY DEFINER, so the signed-in
    // admin can still see every account through it.
    supabase.rpc("admin_accounts"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("admins").select("profile_id"),
  ]);

  const authById = new Map(authList.data.users.map((u) => [u.id, u]));
  const adminIds = new Set((adminRows ?? []).map((r) => r.profile_id));

  let users: AdminUser[] = (accounts ?? []).map((a) => {
    const auth = authById.get(a.id);
    return {
      id: a.id,
      email: auth?.email ?? null,
      confirmed: Boolean(auth?.email_confirmed_at),
      banned: isBanned(auth?.banned_until as string | null | undefined),
      createdAt: a.created_at,
      username: a.username,
      displayName: a.display_name,
      saleCount: Number(a.sale_count),
      savedCount: Number(a.saved_count),
      findCount: Number(a.find_count),
      wishlistCount: Number(a.wishlist_count),
      isEmpty: a.is_empty,
      isAdmin: adminIds.has(a.id),
      isSelf: a.id === me.id,
    };
  });

  if (query) {
    users = users.filter(
      (u) =>
        u.email?.toLowerCase().includes(query) ||
        u.username?.toLowerCase().includes(query) ||
        u.displayName?.toLowerCase().includes(query),
    );
  }
  if (filter === "empty") users = users.filter((u) => u.isEmpty);
  if (filter === "suspended") users = users.filter((u) => u.banned);
  if (filter === "active") users = users.filter((u) => !u.isEmpty);

  const emptyCount = (accounts ?? []).filter((a) => a.is_empty).length;

  return (
    <>
      <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
        Accounts
      </h1>
      <p className="mt-3 text-ink-soft">
        {accounts?.length ?? 0} total.{" "}
        {emptyCount > 0 && (
          <>
            <span className="font-semibold text-ink">{emptyCount}</span> have never done anything —
            no handle, no sales, no saves. That&rsquo;s the shape of the accounts that signed
            themselves up before the bot check went in.
          </>
        )}
      </p>

      <form className="mt-6" action="/admin/users">
        <label htmlFor="q" className="block text-sm font-semibold">
          Search
        </label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="email, handle, or name"
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
        <Chip base="/admin/users" value="" label="All" active={filter === ""} />
        <Chip
          base="/admin/users"
          value="empty"
          label={`Empty (${emptyCount})`}
          active={filter === "empty"}
        />
        <Chip base="/admin/users" value="active" label="Has activity" active={filter === "active"} />
        <Chip base="/admin/users" value="suspended" label="Suspended" active={filter === "suspended"} />
      </div>

      {users.length === 0 ? (
        <p className="mt-6 rounded-[14px] border border-hair bg-panel px-4 py-6 text-center text-sm text-ink-soft">
          Nothing matches.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {users.map((user) => (
            <UserRow key={user.id} user={user} />
          ))}
        </ul>
      )}
    </>
  );
}
