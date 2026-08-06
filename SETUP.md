# XLResale — dashboard setup

Everything here happens in a web browser. No terminal, no code. Claude Code
handles the code side; these are the parts only you can click.

Work top to bottom — later steps depend on earlier ones.

---

## 1. Create the Supabase project

A dedicated project, not tables inside Xandland Platform. The reason is
`auth.users`: Supabase Auth is per-project and cannot be split by schema, so
sharing would make every Xandland signup an XLResale user and vice versa. This
also matches what you already do — XLEats, XLSites, and XL Courtside each have
their own project in this org.

**On the organization:** you have three — `Screenreads`, `Xandland.com`, and
`Xandland Primary`. Use **Xandland.com**, which currently has no projects in it
and should be on the free plan.

An organization is only a billing and team container. It does not join databases
together — a separate *project* is what gives XLResale its own database, its own
users, its own everything, and that's true in any org. So the free one gives the
same isolation as the $10/month one.

The tradeoff: free projects pause after about a week of inactivity, and a free
org allows two active projects. That's fine while building — you unpause with one
click — but it has to move to a paid org before real hosts start listing sales.
Right now there's no data, so that move is about ten minutes: create the paid
project, run `schema.sql`, change three variables in Vercel. It gets expensive to
put off once the app is live, so it's on the pre-launch checklist.

> **Sanity check:** if the "compute size Micro increases your monthly costs by
> $10" warning appears, you're in the wrong org — back out and switch the
> dropdown to `Xandland.com`. On the free plan that warning doesn't show.

1. Go to **https://supabase.com/dashboard**.
2. Click **New project**.
3. Set the **organization** dropdown to **Xandland.com**.
4. Fill in:
   - **Name:** `XLResale`
   - **Database Password:** click **Generate a password**, then **copy it
     somewhere safe** — you will not be shown it again. You won't need it
     day-to-day; it's for direct database connections and account recovery.
   - **Region:** `East US (Ohio)` — same region as Xandland Platform, and about
     as close to Texas as the US options get.
5. Click **Create new project**. Provisioning takes about two minutes.
6. **Tell me in chat when it's done.** I'll pull the project reference and the
   API keys myself — see step 5 below.

**Before launch:** move this to a paid org so it stops pausing. Ten minutes now,
a real migration later.

---

## 2. Turn on the two database extensions

1. In the left sidebar, click **Database**.
2. Click **Extensions**.
3. In the search box, type `postgis`. Find **postgis** in the list and click the
   toggle so it turns green.
4. Clear the search box, type `pg_cron`. Find **pg_cron** and toggle it on too.

Both must be green before the next step.

---

## 3. Create the photo storage bucket

Do this **before** running the schema — the schema attaches security policies to
this bucket, and it has to exist first.

1. In the left sidebar, click **Storage**.
2. Click **New bucket**.
3. **Name:** `sale-photos` — exactly that, lowercase, with the hyphen.
4. Turn **Public bucket** **ON**. (Sale photos are meant to be seen by shoppers
   who aren't signed in. Who can *upload* is still locked down by the policies in
   step 4.)
5. Click **Save**.

---

## 4. Run the database schema

1. In the left sidebar, click **SQL Editor**.
2. Click **New query**.
3. Open `schema.sql` from the repo, select all of it, and copy.
4. Paste it into the SQL editor box.
5. Click **Run** (bottom right).

You should see **Success. No rows returned**.

To confirm it worked: click **Table Editor** in the sidebar. You should see eight
tables — `profiles`, `categories`, `sales`, `sale_categories`, `sale_photos`,
`saved_routes`, `sale_watchers`, `notification_prefs`. Click **categories**; it
should have 8 rows (Tools, Vinyl / Media, Furniture, and so on).

> If you get an error mentioning `pg_cron` or `postgis`, go back to step 2 — one
> of the toggles didn't take. Re-running the whole file after fixing it is safe.

---

## 5. The Supabase keys — you don't have to send me anything

I'm already signed in to your Supabase account from the command line, so once
the project exists I pull the project reference and both API keys myself and
write them straight into `.env.local`. Nothing sensitive needs to go through
chat. Just tell me the project is created.

**For Vercel**, you copy the values yourself, straight from the dashboard:

1. In the left sidebar, click **Project Settings** (the gear at the bottom).
2. Click **API Keys**.
3. Open **https://vercel.com/dashboard** → the **xlresale** project →
   **Settings** → **Environment Variables**, and add these three. The names must
   match exactly — a typo here shows up as a confusing runtime error later.

   | Vercel variable name | Where to copy it from |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | **Project URL** — looks like `https://abcdefgh.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **anon / public** key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** key — click **Reveal** first |

4. Leave all three environments (Production, Preview, Development) ticked, and
   click **Save** for each.

> The **service_role** key ignores every security rule in the database and can
> read or write anything. It belongs in Vercel and nowhere else — never in a
> message, a screenshot, or a variable whose name starts with `NEXT_PUBLIC_`
> (that prefix means "ship this to the browser"). The anon key is safe to expose;
> that's what row-level security is protecting.
>
> If it ever does leak, you can invalidate it: **Project Settings → API Keys →
> the ⋯ menu next to the key → Roll**. Nothing else needs changing beyond pasting
> the new value back into Vercel.

---

## 6. Google Maps Platform key

Needed from Phase 2 on (address autocomplete), so you can do this now or later.

You already have a Google API key powering Places in XLSites, and billing is
already attached to whatever Cloud project it lives in. **Reuse that project —
but make a new key.** XLResale's key has to be locked to your website addresses
(that's what protects it, since it ships to the browser), and a key locked that
way stops working for server-side calls. Adding that restriction to the existing
key would break XLSites.

1. Go to **https://console.cloud.google.com/**.
2. **APIs & Services** → **Credentials**. Find the existing key you use for
   XLSites Places and note which project the dropdown at the top is showing —
   that's the project to stay in. **Don't edit that key.**
3. In the same project, go to **APIs & Services** → **Library**. Enable these
   four, one at a time (search the name, click it, click **Enable**). Some may
   already be on:
   - **Maps JavaScript API**
   - **Places API**
   - **Routes API**
   - **Time Zone API**
4. Go to **APIs & Services** → **Credentials** → **Create credentials** →
   **API key**. Copy the key.
5. Click **Edit API key** on the one you just made:
   - **Name:** `xlresale-browser` — so you can tell it apart later.
   - **Application restrictions** → **Websites**. Click **Add** and enter each of
     these on its own line:
     - `http://localhost:3011/*`
     - `https://xlresale.com/*`
     - `https://*.vercel.app/*`
   - **API restrictions** → **Restrict key** → tick the four APIs from step 3.
   - Click **Save**. Restriction changes can take a few minutes to take effect.
6. Paste the key to me in chat.

---

## 7. Stripe test keys — done

Already handled. I reused the **test-mode** keys from your XLSites Stripe
account, so XLResale's $5 payments will show up in that same Stripe dashboard.
Nothing for you to do here.

Two notes:

- Your live keys exist in that same file. I did **not** copy them. XLResale stays
  in test mode until you decide to flip it.
- The webhook secret is per-endpoint, so it can't be reused. Once I've built the
  webhook in Phase 3, I'll walk you through creating the endpoint that generates
  it.

If you'd rather XLResale's money be completely separate from XLSites — its own
books, its own payouts — say so and I'll switch it to its own Stripe account
instead. Easier to decide now than after real payments start.

---

## 8. The full Vercel environment variable list

Step 5 covers the three Supabase ones. Here's everything, so you can work down a
single list. Add each in **xlresale → Settings → Environment Variables** with all
three environments (Production, Preview, Development) ticked.

| Name | Value | Needed by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API Keys | Phase 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page, **anon / public** | Phase 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | same page, **service_role** (Reveal first) | Phase 3 |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | the new `xlresale-browser` key from step 6 | Phase 2 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ask me — it's in `.env.local` already | Phase 3 |
| `STRIPE_SECRET_KEY` | ask me — same | Phase 3 |
| `STRIPE_WEBHOOK_SECRET` | doesn't exist yet; comes in Phase 3 | Phase 3 |

After adding them, go to the **Deployments** tab, click the **⋯** menu on the
most recent deployment, and choose **Redeploy**. Environment variables only apply
to builds that run *after* they're added — this catches people out constantly.

---

## What I need from you

- [ ] **Create the Supabase project** (step 1) and tell me it's done. I'll pull
      the reference and keys myself.
- [ ] Add the three Supabase variables in Vercel (step 5).
- [ ] Google Maps key (step 6) — paste it in chat. It's a browser key locked to
      your domains, so it isn't a secret in the way the others are.
- [x] ~~Stripe keys~~ — reused from XLSites, already in `.env.local`.

Only the Supabase project blocks Phase 1 (magic-link sign-in). Google Maps isn't
needed until Phase 2.
