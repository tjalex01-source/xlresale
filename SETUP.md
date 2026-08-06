# XLResale — setup

## Done

The Supabase project is built and running. I did all of this from the command
line, so there's nothing to redo:

- **Project created** — named `XLResale`, in the **Xandland.com** organization
  (free plan, so no change to your monthly bill), region East US (Ohio).
  Reference: `nkykpkzesfpetjcnowri`.
- **Extensions on** — PostGIS (distance/geography) and pg_cron (the auto-close job).
- **Schema applied** — all 8 tables, 17 security policies, row-level security on
  every table, the `sales_near()` map query, the auto-close job running every 5
  minutes, live updates enabled on `sales`, and the 8 categories seeded.
- **Storage bucket created** — `sale-photos`, public read, 10 MB per file, images
  only. Uploads are locked to each host's own folder.
- **Keys wired locally** — `.env.local` has the Supabase and Stripe values. The
  app runs and reports "Supabase reachable, 8 categories seeded."

**One thing to put away safely:** the database password is sitting in
`SUPABASE-DB-PASSWORD.txt` in the project folder. It's excluded from Git, so it
will never reach GitHub — but move it into your password manager and delete the
file. You won't need it day to day.

---

## Your remaining tasks

### 1. Add the Supabase variables in Vercel

Local dev works without this; it's what makes the deployed site work.

1. Supabase dashboard → **XLResale** → **Project Settings** → **API Keys**.
2. Vercel → **xlresale** → **Settings** → **Environment Variables**.
3. Add these three, with all environments (Production, Preview, Development) ticked:

   | Vercel variable name | What to copy |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://nkykpkzesfpetjcnowri.supabase.co` — you can type this one straight in |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **publishable** key (starts `sb_publishable_`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | the **secret** key (starts `sb_secret_`) — click to reveal |

> **Use the publishable/secret keys, not the older `anon`/`service_role` JWTs.**
> Supabase shows both; I wired the new ones locally, and local and Vercel have to
> match or you'll get confusing failures in one place but not the other.
>
> The **secret** key ignores every security rule in the database. It belongs in
> Vercel and nowhere else — never in a message, and never in a variable starting
> `NEXT_PUBLIC_`, since that prefix means "ship this to the browser." The
> publishable key is safe to expose; that's what row-level security protects.

4. When Phase 3 arrives I'll give you the two Stripe values to add here too.

### 2. Google Maps key

Not needed until Phase 2, so this can wait.

You already have a Google API key powering Places in XLSites, and billing is
attached to whatever Cloud project owns it. **Reuse that project, but make a new
key.** XLResale's key runs in the browser, so it has to be locked to your website
addresses — and a key locked that way stops working for server-side calls, which
is how XLSites uses the existing one. Restricting that key would break XLSites.

1. **https://console.cloud.google.com/** → **APIs & Services** → **Credentials**.
   Find the key XLSites uses and note which project the dropdown shows. That's
   the project to stay in. **Don't edit that key.**
2. Same project → **APIs & Services** → **Library**. Enable these four (some may
   already be on):
   - **Maps JavaScript API**
   - **Places API**
   - **Routes API**
   - **Time Zone API**
3. **Credentials** → **Create credentials** → **API key**. Copy it.
4. Click **Edit API key** on the new one:
   - **Name:** `xlresale-browser`
   - **Application restrictions** → **Websites** → **Add**, one per line:
     - `http://localhost:3011/*`
     - `https://xlresale.com/*`
     - `https://*.vercel.app/*`
   - **API restrictions** → **Restrict key** → tick the four APIs above.
   - **Save.** Restrictions can take a few minutes to take effect.
5. Paste the key in chat. It's locked to your domains, so it isn't a secret the
   way the others are.

### 3. Push to GitHub

I commit; you push in GitHub Desktop, and Vercel deploys from there.

---

## Before launch

**Move the Supabase project to a paid organization.** Free projects pause after
about a week of inactivity, and a paused database means a broken site. Right now
there's no data, so moving is roughly ten minutes — create the project in
`Xandland Primary`, re-run the schema, update three Vercel variables. It gets
genuinely painful once real hosts have listed real sales. Don't let this one
slide.

*(Related: your Dog Pound Academy database is currently paused for exactly this
reason, which is why the coach portal can't sign anyone in.)*
