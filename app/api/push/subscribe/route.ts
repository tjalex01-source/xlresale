import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Register or drop this device for web push.
 *
 * Keyed on the endpoint, which is the push service's unique URL for this
 * browser: re-subscribing the same device must update rather than insert, or
 * every alert goes out twice.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request body." }, { status: 400 });
  }

  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys.auth) {
    return NextResponse.json({ error: "Incomplete subscription." }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    // Logged server-side, generic to the browser: Postgres errors carry table
    // and column names, and sometimes row values.
    console.error("push subscribe failed:", error.message);
    return NextResponse.json({ error: "Couldn't save this device." }, { status: 500 });
  }

  // Granting the browser permission IS the opt-in, so turn the preference on
  // rather than making them agree a second time in our own UI.
  await supabase.from("notification_prefs").update({ push_enabled: true }).eq("profile_id", user.id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "No endpoint." }, { status: 400 });

  // RLS scopes the delete to this user's own rows regardless of what endpoint
  // is passed, so a guessed endpoint can't unsubscribe somebody else.
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    console.error("push unsubscribe failed:", error.message);
    return NextResponse.json({ error: "Couldn't remove this device." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
