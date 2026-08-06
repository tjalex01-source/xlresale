# XLResale — dashboard setup

Everything here happens in a web browser. No terminal, no code. Claude Code
handles the code side; these are the parts only you can click.

Work top to bottom — later steps depend on earlier ones.

---

## 1. Create the Supabase project

A dedicated project, not a shared one (CLAUDE.md §15).

1. Go to **https://supabase.com/dashboard**.
2. Click **New project**.
3. Fill in:
   - **Name:** `xlresale`
   - **Database Password:** click **Generate a password**, then **copy it somewhere
     safe** — you will not be shown it again.
   - **Region:** `East US (North Virginia)` — closest to Texas of the US options.
4. Click **Create new project**. Provisioning takes about two minutes.

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

## 5. Copy the Supabase keys

1. In the left sidebar, click **Project Settings** (the gear at the bottom).
2. Click **API keys**.
3. You need three values. **Paste them to me in chat** and I'll put them in the
   right files — don't try to edit anything yourself.
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (a long string starting `eyJ...`)
   - **service_role** key — click **Reveal** first. This one is a secret that can
     read and write anything, ignoring all security rules. It only ever lives on
     the server. Don't paste it anywhere else.

---

## 6. Google Maps Platform key

Needed from Phase 2 on (address autocomplete), so you can do this now or later.

1. Go to **https://console.cloud.google.com/**.
2. Top bar, click the project dropdown → **New Project**. Name it `xlresale`.
   Click **Create**, then make sure it's selected in the dropdown.
3. Left menu → **Billing** → **Link a billing account**. Maps Platform will not
   serve requests without billing attached. Google gives a recurring monthly
   free credit that covers early development.
4. Search the top bar for **APIs & Services** → **Library**. Enable these four,
   one at a time (search the name, click it, click **Enable**):
   - **Maps JavaScript API**
   - **Places API**
   - **Routes API**
   - **Time Zone API**
5. Go to **APIs & Services** → **Credentials** → **Create credentials** →
   **API key**. Copy the key.
6. Click the new key's name to edit it, then:
   - **Application restrictions** → **Websites**. Click **Add** and enter each of
     these on its own line:
     - `http://localhost:3011/*`
     - `https://xlresale.com/*`
     - `https://*.vercel.app/*`
   - **API restrictions** → **Restrict key** → tick the four APIs from step 4.
   - Click **Save**.
7. Paste the key to me in chat.

---

## 7. Stripe test keys

Needed for Phase 3. Stay in **test mode** — the toggle in the top right of the
Stripe dashboard should say **Test mode**.

1. Go to **https://dashboard.stripe.com/test/apikeys**.
2. Copy the **Publishable key** (starts `pk_test_`).
3. Click **Reveal test key** on the **Secret key** (starts `sk_test_`) and copy it.
4. Paste both to me in chat.

The webhook secret comes later — I'll build the webhook first, then walk you
through creating the endpoint that generates it.

---

## 8. Add the same values in Vercel

Once you've sent me the keys and I've confirmed things run locally:

1. Go to **https://vercel.com/dashboard** and open the **xlresale** project.
2. **Settings** → **Environment Variables**.
3. For each key, enter the **Name** exactly as written in `.env.example`, paste
   the **Value**, leave all three environments (Production, Preview, Development)
   ticked, and click **Save**.
4. After adding them all, go to the **Deployments** tab, click the **⋯** menu on
   the most recent deployment, and choose **Redeploy**. Environment variables
   only apply to builds that run after they're added.

---

## What I still need from you

Paste these into chat when you have them:

- [ ] Supabase Project URL
- [ ] Supabase anon public key
- [ ] Supabase service_role key
- [ ] Google Maps API key
- [ ] Stripe publishable key (`pk_test_`)
- [ ] Stripe secret key (`sk_test_`)

Then Phase 1 (magic-link sign-in) can start.
