"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { deleteUser, setUserBanned } from "../actions";

export interface AdminUser {
  id: string;
  email: string | null;
  confirmed: boolean;
  banned: boolean;
  createdAt: string;
  username: string | null;
  displayName: string | null;
  saleCount: number;
  savedCount: number;
  findCount: number;
  wishlistCount: number;
  isEmpty: boolean;
  isAdmin: boolean;
  isSelf: boolean;
}

export function UserRow({ user }: { user: AdminUser }) {
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  if (gone) return null;

  return (
    <li
      className={`rounded-[16px] border bg-panel p-4 ${
        user.banned ? "border-pink/40" : "border-hair"
      }`}
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-bold">
              {user.username ? `@${user.username}` : (user.displayName ?? "No handle")}
            </span>
            {user.isAdmin && (
              <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-xs font-bold text-canvas">
                ADMIN
              </span>
            )}
            {user.banned && (
              <span className="rounded-full bg-pink-50 px-2 py-0.5 font-mono text-xs font-bold text-pink-ink">
                SUSPENDED
              </span>
            )}
            {!user.confirmed && (
              <span className="rounded-full bg-tangerine-50 px-2 py-0.5 font-mono text-xs font-bold text-tangerine-ink">
                UNCONFIRMED
              </span>
            )}
            {user.isEmpty && (
              <span className="rounded-full bg-tangerine-50 px-2 py-0.5 font-mono text-xs font-bold text-tangerine-ink">
                EMPTY
              </span>
            )}
          </p>

          <p className="mt-1 font-mono text-[13px] text-muted">{user.email ?? "no email"}</p>

          <p className="mt-1 font-mono text-[13px] text-ink-soft">
            joined {user.createdAt.slice(0, 10)} · {user.saleCount} sales · {user.savedCount} saved
            · {user.findCount} finds · {user.wishlistCount} alerts
          </p>

          {user.username && (
            <Link
              href={`/u/${user.username}`}
              className="mt-1 inline-block text-sm font-semibold text-muted underline underline-offset-4 hover:text-pink"
            >
              View profile
            </Link>
          )}
        </div>

        {!user.isSelf && !user.isAdmin && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await setUserBanned(user.id, !user.banned);
                  setMessage(result.ok ? (result.message ?? "Done.") : result.message);
                })
              }
              className="min-h-11 rounded-[10px] border border-hair px-3 text-sm font-semibold hover:border-pink hover:text-pink disabled:opacity-50"
            >
              {user.banned ? "Restore" : "Suspend"}
            </button>

            {confirmingDelete ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteUser(user.id);
                      if (result.ok) setGone(true);
                      else setMessage(result.message);
                    })
                  }
                  className="min-h-11 rounded-[10px] bg-pink px-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  Delete for good
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="min-h-11 rounded-[10px] px-3 text-sm font-semibold text-muted hover:text-ink"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="min-h-11 rounded-[10px] px-3 text-sm font-semibold text-muted hover:text-pink"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {confirmingDelete && (
        <p className="mt-3 rounded-[10px] bg-pink-50 px-3.5 py-2.5 text-sm text-pink-ink">
          This removes the account and everything on it — sales, saved sales, finds. There&rsquo;s
          no undo.
        </p>
      )}

      {message && (
        <p className="mt-3 text-sm text-ink-soft" role="status">
          {message}
        </p>
      )}
    </li>
  );
}
