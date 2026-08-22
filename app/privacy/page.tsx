import Link from "next/link";
import type { Metadata } from "next";

import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = {
  title: "Privacy — XLResale",
  description: "What XLResale collects, why, who else sees it, and how to delete it.",
};

/**
 * Written from the actual schema rather than from a template, so it can be
 * checked against the database line by line. If a column is added that holds
 * something about a person, it belongs on this page too.
 */
export default function PrivacyPage() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-2xl items-center gap-4 px-6 py-6">
        <Link href="/" className="inline-block hover:text-pink">
          <Wordmark className="!text-xl" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-6 pb-24">
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-none tracking-[-0.02em]">
          Privacy
        </h1>
        <p className="mt-3 text-ink-soft">
          The short version: we collect what the app needs to work, your home address is never
          public, and you can delete everything yourself in about ten seconds.
        </p>

        <Section title="What we collect">
          <H>To sign you in</H>
          <P>
            Your email address and a password. The password is hashed by Supabase, our database
            provider — nobody at XLResale can read it, including us.
          </P>

          <H>Your profile</H>
          <P>
            A handle, a display name, and optionally a short bio. These are public if you choose to
            make your profile public. Nothing else on your profile is.
          </P>

          <H>Where you shop from</H>
          <P>
            If you set a home address, we store it along with its coordinates. This is what
            &ldquo;near me&rdquo; measures from and where a route starts. It is{" "}
            <strong>never shown on your public profile</strong> and never sent to another
            visitor&rsquo;s browser — the distance maths happens on our server so the coordinates
            don&rsquo;t have to leave it.
          </P>

          <H>Sales you host</H>
          <P>
            Title, description, address and coordinates, date, hours, categories, photos, and any
            items you list. A published sale is public, by design — but the exact address is only
            shown from half an hour before it opens until three hours after it closes. Before and
            after that, everyone sees the block, not the house. That rule is enforced by the
            database itself, not just the interface — the exact address genuinely isn&rsquo;t reachable
            outside that window.
          </P>

          <H>What you do as a shopper</H>
          <P>
            Sales you save, routes you plan, search terms you ask to be alerted about, and finds you
            log. Finds are private unless you mark them public.
          </P>

          <H>Notifications</H>
          <P>
            Your channel preferences, and — if you turn on notifications — an identifier for that
            browser or phone from its push service. That identifier lets us send a notification to
            that device; it doesn&rsquo;t tell us anything else about it.
          </P>
        </Section>

        <Section title="What we don't collect">
          <P>
            No card numbers, bank details, or government ID. When payments arrive, Stripe will
            handle them and we&rsquo;ll store only a payment reference. No third-party analytics, no
            advertising trackers, and no session recording anywhere on the site.
          </P>
        </Section>

        <Section title="Who else sees it">
          <P>These companies process data because the app runs on them:</P>
          <ul className="mt-3 space-y-2 text-ink-soft">
            <Item name="Supabase">the database, sign-in, and photo storage</Item>
            <Item name="Vercel">hosting; it keeps short-lived server logs of requests</Item>
            <Item name="Google Maps">
              address lookup, the map itself, and drive times between stops
            </Item>
            <Item name="Cloudflare Turnstile">
              the &ldquo;are you a robot&rdquo; check on sign-up and sign-in
            </Item>
            <Item name="Resend">sending email</Item>
          </ul>
          <P>
            We don&rsquo;t sell your data, and we don&rsquo;t share it with anyone else.
          </P>
        </Section>

        <Section title="Meeting people">
          <P>
            XLResale connects people; it never handles payments between them. You pay a host
            directly — cash, Venmo, whatever you agree. We take a listing fee from hosts and never
            a cut of what changes hands. Meet safely and trust your gut.
          </P>
        </Section>

        <Section title="Deleting your account">
          <P>
            Go to{" "}
            <Link
              href="/account/delete"
              className="font-semibold text-ink underline underline-offset-4"
            >
              your account settings
            </Link>{" "}
            and delete it. It happens immediately and takes everything with it: your profile, your
            sales and their photos, your saved sales, routes, alerts and finds, and any devices set
            up for notifications. There is no soft-delete and we keep no copy.
          </P>
          <P>
            One thing survives: if an administrator ever took action on an account, the record of
            that decision stays, with the administrator&rsquo;s identity removed. It contains no
            personal data about you beyond the fact that the action happened.
          </P>
          <P>
            You can also just turn things off without deleting — alerts, notifications, and your
            public profile each have their own switch, and a sale can be taken off the map without
            being deleted.
          </P>
        </Section>

        <Section title="Getting in touch">
          <P>
            Questions, or want a copy of what we hold about you? Email{" "}
            <a
              href="mailto:hello@xlresale.com"
              className="font-semibold text-ink underline underline-offset-4"
            >
              hello@xlresale.com
            </a>
            .
          </P>
        </Section>

        <p className="mt-10 text-sm text-muted">
          If we change what we collect, we&rsquo;ll change this page.
        </p>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 font-display text-lg font-bold">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-ink-soft">{children}</p>;
}

function Item({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <li>
      <span className="font-semibold text-ink">{name}</span> — {children}
    </li>
  );
}
