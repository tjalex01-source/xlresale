import Link from "next/link";

import { Wordmark } from "@/components/Wordmark";

/**
 * Chrome for the admin screens.
 *
 * Deliberately does NOT gate access: a layout runs for its pages but not for
 * Server Actions, so treating it as the security boundary would leave the
 * actions open. Each page and each action calls requireAdmin/assertAdmin itself.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-hair">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-5">
          <Link href="/" className="inline-block hover:text-pink">
            <Wordmark className="!text-xl" />
          </Link>
          <span className="rounded-full bg-ink px-2.5 py-0.5 font-mono text-xs font-bold text-canvas">
            ADMIN
          </span>

          <nav className="ml-auto flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/admin" className="hover:text-pink">
              Overview
            </Link>
            <Link href="/admin/users" className="hover:text-pink">
              Accounts
            </Link>
            <Link href="/admin/sales" className="hover:text-pink">
              Sales
            </Link>
            <Link href="/account" className="text-muted hover:text-pink">
              Leave admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 pb-24 pt-8">{children}</main>
    </>
  );
}
