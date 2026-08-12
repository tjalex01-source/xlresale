"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Keeps one sale's page in step with the host.
 *
 * This is the shopper half of the product's core promise (CLAUDE.md §1): the
 * host taps Go Live, drops a price, or marks a chair sold, and the shopper sees
 * it without touching anything. `sales` and `sale_items` are the two tables in
 * the realtime publication, and they are exactly the two the host mutates.
 *
 * It refreshes the server component rather than patching state locally. The
 * page already derives prices through the same rules the database uses, and a
 * second copy of that logic living in a socket handler is how the two drift.
 * The cost is one cheap RSC re-render per host action.
 */
export function SaleRealtime({ saleId }: { saleId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`sale:${saleId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sales", filter: `id=eq.${saleId}` },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        // Items are INSERTed, UPDATEd (sold, price drop) and DELETEd, so this
        // one listens to all of them rather than naming each event.
        { event: "*", schema: "public", table: "sale_items", filter: `sale_id=eq.${saleId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      // Without this, navigating between sales stacks up live sockets and the
      // page keeps refreshing on behalf of sales the shopper already left.
      supabase.removeChannel(channel);
    };
  }, [saleId, router]);

  return null;
}
