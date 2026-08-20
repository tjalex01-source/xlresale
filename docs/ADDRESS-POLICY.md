# Host address precision — decided

**The rule:** precision exists only while somebody has a real reason to drive there.

| When | What a stranger sees |
|---|---|
| More than 7 days before the sale | Nothing — the sale isn't public yet |
| Up to 7 days before | `1200 block of W Main St, Bullard, TX` + a point snapped to a ~220 m grid |
| From 30 min before opening until 3 h after closing | The exact address and the exact point |
| After that | Back to block level, permanently |

This is the one XLResale exposure that is about **physical safety**, not just privacy.
A stranger reading the map learns that a live sale means a specific house is occupied by
someone distracted and expecting strangers to walk up — and that a closed sale means
nobody is watching a house that just advertised it had valuables.

---

## The five questions

**1. Pin precision before the sale goes live — exact, or block-level?**
Block level. Street and block number, with the point snapped to a fixed grid.

**2. At close — does the exact address stay, degrade, or disappear?**
Degrades back to block level three hours after closing. The listing itself stays up so
shared links and saved lists don't rot, but nobody needs to navigate to a finished sale.

**3. Does the address ship in the `sales_near()` payload to every browser, or only after
a host action?**
This was the question that mattered, and the honest answer before this change was: **yes,
to everyone, immediately, including sales weeks away.** The anon key ships in the
JavaScript bundle, so anyone could query PostgREST directly and pull every host's exact
address in a radius. Pin precision applied in the UI would have been decoration.

Now the database itself never emits an exact address outside the window. `SELECT` on
`sales.address` and `sales.location` is revoked from `anon` and `authenticated`
entirely; everything public goes through the `public_sales` view or the
`sales_near_*` functions, which apply the rule on the way out.

**4. Can a host preview what a stranger sees before publishing?**
Yes. *View as a shopper* on the host dashboard renders the public view — so a published
sale shows the host exactly the coarsened address a stranger gets, at the same moment.

**5. Is there a takedown path if a host feels unsafe mid-sale?**
Yes, and it belongs to the host. *Take it off the map now* on the sale dashboard removes
the pin, the listing, and any pending alerts immediately — one tap, no confirmation step,
because the friction belongs on putting it back rather than on taking it down. The listing
is not refunded or deleted, and the host can restore it whenever they want.

An admin can also take a sale down. When they do, `hidden_by_admin` is set and the host
cannot reverse it — otherwise a moderation decision would last exactly as long as it took
the host to tap *show again*.

---

## Why the reveal is time-based, not Go Live

Go Live already carries the status signal. If it also controlled findability, a host who
forgot to tap it would leave shoppers on the right street with no house number. The
reveal is therefore automatic and clock-driven; Go Live stays what it is, a statement
that the host is actually out there.

## Why coarsening is deterministic

The coarse point is snapped to a fixed grid, so the same sale always returns the same
coarse coordinates. Random jitter looks private and isn't: request the same sale
repeatedly, average the offsets, and the true point falls out. A grid gives away nothing
extra no matter how many times it is read.

## Why the block is shown rather than hidden

`1200 block of W Main St` lets a shopper plan a route and is honest about what it is. A
vague pin with no text reads as a broken listing.

## Where this is implemented

`schema-additions-address-policy.sql` — the window function, the coarsening functions,
the `public_sales` and `host_sales` views, the column revoke, and the rewritten
`sales_near_upcoming` / `sales_near_me` / `my_saved_sales`.

Verified by probing every anonymous route to an out-of-window exact address — the view,
the base table by every column selection, the RPCs, an `order=address` trick, and a blind
`address=like.*` filter used as an extraction oracle. All denied or coarsened.
